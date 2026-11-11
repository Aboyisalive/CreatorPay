import { db } from "@/lib/db";
import type { PayoutState } from "@/generated/prisma/enums";
import { conflict, notFound } from "@/lib/errors";
import { ZERO_MINOR, type Minor } from "@/lib/money-server";
import { newOpaqueToken } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";
import { formatMinor } from "@/lib/format";
import { notify } from "@/lib/notify";
import { log } from "@/lib/logging";
import { getPaymentProvider } from "./provider";
import { requireBankDetails } from "./bank-details";
import { recordPayoutSettled, recordRewardApproved } from "./ledger";

/**
 * Payout state machine (integration plan section 10.4).
 *
 * `approved -> submitted -> pending -> settled | failed`, plus `unknown` after a
 * transport failure. A transfer acknowledgement is NOT settlement: the payout
 * call returns pending/failed, and only a later status query (or a confirmed
 * webhook) moves it to settled. The `request_id` is minted and persisted BEFORE
 * the bank call and reused on retry, so a lost response can never double-pay.
 *
 * Ledger timing (deliberate adaptation of section 10.2): the escrow ->
 * creator_payable move happens ONCE, the first time a payout is initiated for a
 * reward, not at reward approval. This keeps approval escrow-free (rewards can
 * still be reviewed on an unfunded campaign) while gating the real money behind
 * escrow. Retries after a failure reuse the already-funded payable and never
 * re-fund it. On failure no ledger moves -- the creator stays payable.
 */

const ACTIVE_STATES = ["APPROVED", "SUBMITTED", "PENDING", "UNKNOWN"] as const;
const PAYABLE_REWARD_STATES = ["APPROVED", "PAYABLE", "PAYMENT_FAILED"] as const;

export type PayoutView = {
  id: string;
  rewardCalculationId: string;
  requestId: string;
  bankReference: string | null;
  amountMinor: string;
  currency: string;
  bankCode: string;
  accountNo: string;
  narration: string;
  state: string;
  rawCode: string | null;
  lastCheckedAt: string | null;
  settledAt: string | null;
  createdAt: string;
};

export async function initiatePayout(input: {
  rewardId: string;
  actorUserId: string;
  workspaceId: string;
}): Promise<PayoutView> {
  const reward = await db.rewardCalculation.findUnique({
    where: { id: input.rewardId },
    include: {
      campaign: { select: { id: true, name: true, workspaceId: true } },
      participant: {
        select: {
          creatorProfileId: true,
          creatorProfile: { select: { userId: true, displayName: true } },
        },
      },
      payouts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!reward || reward.campaign.workspaceId !== input.workspaceId) {
    throw notFound("Reward not found.");
  }
  const active = reward.payouts.find((p) =>
    (ACTIVE_STATES as readonly string[]).includes(p.state),
  );
  if (active) {
    throw conflict("A payout is already in progress for this reward.");
  }
  if (!(PAYABLE_REWARD_STATES as readonly string[]).includes(reward.status)) {
    throw conflict(`Reward is ${reward.status} and cannot be paid out.`);
  }

  const creatorProfileId = reward.participant.creatorProfileId;
  const bank = await requireBankDetails(creatorProfileId); // 404 if none
  const amountMinor = reward.totalMinor;
  const requestId = `po_${newOpaqueToken()}`;

  // 1. Persist intent (payable funding + payout row + reward state) atomically.
  //    The escrow gate lives in recordRewardApproved: it throws if escrow is
  //    short, rolling the whole thing back so no payout is created.
  const payout = await db.$transaction(async (tx) => {
    // Claim the reward first: of two concurrent requests (double click, retry)
    // only one can move it out of a payable state, so only one payout exists.
    const claimed = await tx.rewardCalculation.updateMany({
      where: { id: reward.id, status: { in: [...PAYABLE_REWARD_STATES] } },
      data: { status: "PAYMENT_INITIATED" },
    });
    if (claimed.count === 0) {
      throw conflict("A payout is already in progress for this reward.");
    }
    const funded = await isPayableFunded(reward.id);
    if (!funded) {
      await recordRewardApproved(tx, {
        rewardId: reward.id,
        campaignId: reward.campaignId,
        creatorProfileId,
        grossMinor: amountMinor,
        feeMinor: ZERO_MINOR,
        currency: reward.currency,
      });
    }
    const created = await tx.payout.create({
      data: {
        rewardCalculationId: reward.id,
        requestId,
        amountMinor,
        currency: reward.currency,
        bankCode: bank.bankCode,
        accountNo: bank.accountNo,
        narration: buildNarration(reward.campaign.name, reward.id),
        state: "APPROVED",
      },
    });
    return created;
  });

  await recordAudit({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "payout.initiated",
    entityType: "Payout",
    entityId: payout.id,
    metadata: { rewardId: reward.id, requestId, amountMinor: amountMinor.toString() },
  });

  // 2. Call the bank outside the transaction.
  return dispatchPayout(payout.id, {
    creatorProfileId,
    creatorUserId: reward.participant.creatorProfile.userId,
    rewardId: reward.id,
    workspaceId: input.workspaceId,
  });
}

export async function reconcilePayout(
  payoutId: string,
  workspaceId?: string,
): Promise<PayoutView> {
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      rewardCalculation: {
        include: {
          campaign: { select: { workspaceId: true } },
          participant: {
            select: { creatorProfileId: true, creatorProfile: { select: { userId: true } } },
          },
        },
      },
    },
  });
  if (!payout || (workspaceId && payout.rewardCalculation.campaign.workspaceId !== workspaceId)) {
    throw notFound("Payout not found.");
  }

  // Terminal states never change.
  if (["SETTLED", "FAILED"].includes(payout.state)) {
    return toView(payout);
  }
  // UNKNOWN with no bank reference cannot be auto-resolved by a status query
  // (the status call keys on the bank's transactionReference). Surface it for
  // manual resolution rather than guessing.
  if (!payout.bankReference) {
    return toView(payout);
  }

  const creatorProfileId = payout.rewardCalculation.participant.creatorProfileId;
  const creatorUserId = payout.rewardCalculation.participant.creatorProfile.userId;
  const result = await getPaymentProvider().payoutStatus(payout.bankReference);
  const state = mapState(result.state);

  // Claim the transition atomically: only one concurrent reconcile may move a
  // payout out of a non-terminal state, so the ledger is posted exactly once.
  const terminal = state === "SETTLED" || state === "FAILED";
  const claimed = await db.payout.updateMany({
    where: { id: payout.id, state: { notIn: ["SETTLED", "FAILED"] } },
    data: {
      state,
      rawCode: result.rawCode,
      lastCheckedAt: new Date(),
      ...(state === "SETTLED" ? { settledAt: new Date() } : {}),
    },
  });
  const updated = await db.payout.findUniqueOrThrow({ where: { id: payout.id } });
  if (claimed.count === 0 || !terminal) {
    return toView(updated);
  }

  if (state === "SETTLED") {
    await settleLedger(updated.id, payout.rewardCalculationId, creatorProfileId, creatorUserId, payout.amountMinor, payout.currency);
  } else {
    await db.rewardCalculation.update({
      where: { id: payout.rewardCalculationId },
      data: { status: "PAYMENT_FAILED" },
    });
    await recordAudit({
      action: "payout.failed",
      entityType: "Payout",
      entityId: payout.id,
      metadata: { requestId: payout.requestId, rawCode: result.rawCode },
    });
  }

  return toView(await db.payout.findUniqueOrThrow({ where: { id: payout.id } }));
}

/** Poll every non-terminal payout with a bank reference that is stale. */
export async function reconcileStalePayouts(olderThanMs = 20_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const stale = await db.payout.findMany({
    where: {
      state: { in: [...ACTIVE_STATES] },
      bankReference: { not: null },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: cutoff } }],
    },
    select: { id: true },
    take: 100,
  });

  let resolved = 0;
  for (const { id } of stale) {
    try {
      await reconcilePayout(id);
      resolved += 1;
    } catch (error) {
      log("warn", "payout.reconcile_error", { payout_id: id, error: String(error) });
    }
  }
  return resolved;
}

const PAYOUT_STATES = ["APPROVED", "SUBMITTED", "PENDING", "SETTLED", "FAILED", "UNKNOWN"];

/** The most recent payout attempt for a reward (for the frontend to poll). */
export async function getLatestPayoutForReward(rewardId: string): Promise<PayoutView | null> {
  const row = await db.payout.findFirst({
    where: { rewardCalculationId: rewardId },
    orderBy: { createdAt: "desc" },
  });
  return row ? toView(row) : null;
}

/** List a workspace's payouts, optionally filtered by state. */
export async function listPayoutsForWorkspace(
  workspaceId: string,
  state?: string | null,
): Promise<PayoutView[]> {
  const rows = await db.payout.findMany({
    where: {
      ...(state && PAYOUT_STATES.includes(state) ? { state: state as PayoutState } : {}),
      rewardCalculation: { campaign: { workspaceId } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toView);
}

// --- internals --------------------------------------------------------------

async function dispatchPayout(
  payoutId: string,
  ctx: { creatorProfileId: string; creatorUserId: string; rewardId: string; workspaceId: string },
): Promise<PayoutView> {
  const payout = await db.payout.findUniqueOrThrow({ where: { id: payoutId } });

  let result;
  try {
    result = await getPaymentProvider().payout({
      accountNo: payout.accountNo,
      bankCode: payout.bankCode,
      amountMinor: payout.amountMinor,
      currency: payout.currency,
      narration: payout.narration,
      requestId: payout.requestId,
    });
  } catch (error) {
    // Transport failure/timeout -> unknown. Never resend under a new ID.
    const unknown = await db.payout.update({
      where: { id: payout.id },
      data: { state: "UNKNOWN", lastCheckedAt: new Date() },
    });
    log("warn", "payout.transport_error", {
      payout_id: payout.id,
      request_id: payout.requestId,
      error: String(error),
    });
    await recordAudit({
      workspaceId: ctx.workspaceId,
      action: "payout.unknown",
      entityType: "Payout",
      entityId: payout.id,
      metadata: { requestId: payout.requestId },
    });
    return toView(unknown);
  }

  const state = mapState(result.state);
  const updated = await db.payout.update({
    where: { id: payout.id },
    data: {
      state,
      bankReference: result.bankReference ?? payout.bankReference,
      rawCode: result.rawCode,
      lastCheckedAt: new Date(),
      ...(state === "SETTLED" ? { settledAt: new Date() } : {}),
    },
  });

  if (state === "SETTLED") {
    await settleLedger(
      updated.id,
      ctx.rewardId,
      ctx.creatorProfileId,
      ctx.creatorUserId,
      updated.amountMinor,
      updated.currency,
    );
  } else if (state === "FAILED") {
    await db.rewardCalculation.update({
      where: { id: ctx.rewardId },
      data: { status: "PAYMENT_FAILED" },
    });
    await recordAudit({
      workspaceId: ctx.workspaceId,
      action: "payout.failed",
      entityType: "Payout",
      entityId: payout.id,
      metadata: { requestId: payout.requestId, rawCode: result.rawCode },
    });
  }

  return toView(updated);
}

async function settleLedger(
  payoutId: string,
  rewardId: string,
  creatorProfileId: string,
  creatorUserId: string,
  amountMinor: Minor,
  currency: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await recordPayoutSettled(tx, {
      payoutId,
      creatorProfileId,
      amountMinor,
      currency,
    });
    await tx.payout.update({ where: { id: payoutId }, data: { state: "SETTLED", settledAt: new Date() } });
    await tx.rewardCalculation.update({ where: { id: rewardId }, data: { status: "PAID" } });
  });

  await recordAudit({
    action: "payout.settled",
    entityType: "Payout",
    entityId: payoutId,
    metadata: { rewardId, amountMinor: amountMinor.toString() },
  });
  await notify({
    userIds: [creatorUserId],
    type: "payout.settled",
    title: "You've been paid",
    body: `Your reward of ${formatMinor(amountMinor.toString(), currency)} has been paid out.`,
    entityType: "Payout",
    entityId: payoutId,
  });
}

async function isPayableFunded(rewardId: string): Promise<boolean> {
  const existing = await db.journalEntry.findFirst({
    where: { refType: "reward", refId: rewardId },
    select: { id: true },
  });
  return existing !== null;
}

function mapState(state: "pending" | "settled" | "failed" | "unknown"): PayoutState {
  return ({ pending: "PENDING", settled: "SETTLED", failed: "FAILED", unknown: "UNKNOWN" } as const)[state];
}

function buildNarration(campaignName: string, rewardId: string): string {
  return `CreatorPay ${campaignName} ${rewardId.slice(-6)}`.slice(0, 100);
}

function toView(row: {
  id: string;
  rewardCalculationId: string;
  requestId: string;
  bankReference: string | null;
  amountMinor: { toString(): string };
  currency: string;
  bankCode: string;
  accountNo: string;
  narration: string;
  state: string;
  rawCode: string | null;
  lastCheckedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
}): PayoutView {
  return {
    id: row.id,
    rewardCalculationId: row.rewardCalculationId,
    requestId: row.requestId,
    bankReference: row.bankReference,
    amountMinor: row.amountMinor.toString(),
    currency: row.currency,
    bankCode: row.bankCode,
    accountNo: row.accountNo,
    narration: row.narration,
    state: row.state,
    rawCode: row.rawCode,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
