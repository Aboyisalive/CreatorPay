import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";
import { notFound, conflict } from "@/lib/errors";
import type { Minor } from "@/lib/money-server";
import { recordAudit } from "@/lib/audit";
import { log } from "@/lib/logging";
import { getPaymentProvider } from "./provider";
import { recordDepositMatched, recordDepositUnmatched } from "./ledger";

/**
 * Campaign funding.
 *
 * A brand funds a campaign by bank transfer, quoting the campaign's unique
 * `fundingReference` as the narration. Inbound money lands as a `Deposit`; the
 * matcher pairs it to a campaign by that reference. Matched deposits credit the
 * campaign's escrow (double-entry); unmatched ones park in the unmatched queue
 * for manual resolution. Every deposit is keyed by a `dedupeKey`, so a redelivered
 * webhook or retried ingest can never credit escrow twice.
 */

export type FundingInstructionsView = {
  fundingReference: string;
  poolAccountDisplay: string;
  fundingStatus: string;
  expiresAt: string | null;
};

/** Fetch (or mint) a campaign's funding instructions. */
export async function getFundingInstructions(
  campaignId: string,
  workspaceId: string,
): Promise<FundingInstructionsView> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) {
    throw notFound("Campaign not found.");
  }

  // Mint a stable reference once; the brand quotes it as the narration.
  let fundingReference = campaign.fundingReference;
  if (!fundingReference) {
    fundingReference = `CP-${randomBytes(6).toString("hex").toUpperCase()}`;
    await db.campaign.update({
      where: { id: campaign.id },
      data: { fundingReference, fundingStatus: "AWAITING_FUNDS" },
    });
  } else if (campaign.fundingStatus === "UNFUNDED") {
    await db.campaign.update({
      where: { id: campaign.id },
      data: { fundingStatus: "AWAITING_FUNDS" },
    });
  }

  const providerInstructions = await getPaymentProvider().fundingInstructions(
    campaign.id,
    campaign.budgetMinor,
    campaign.currency,
  );

  const fresh = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
  return {
    fundingReference,
    poolAccountDisplay: providerInstructions.poolAccountDisplay,
    fundingStatus: fresh.fundingStatus,
    expiresAt: providerInstructions.expiresAt,
  };
}

export type DepositInput = {
  /** Bank-supplied unique id, or a synthetic one for manual/simulated rows. */
  dedupeKey: string;
  bankReference?: string | null;
  amountMinor: Minor;
  currency?: string;
  senderHint?: string | null;
  matchedBy?: "REFERENCE" | "AMOUNT_SENDER" | "MANUAL" | "SIMULATED";
};

export type DepositView = {
  id: string;
  campaignId: string | null;
  bankReference: string | null;
  amountMinor: string;
  state: string;
  matchedBy: string | null;
};

/**
 * Ingest an inbound deposit. Idempotent on `dedupeKey`: a repeat returns the
 * existing row and never double-credits escrow. Attempts to match by the bank
 * reference against a campaign's funding reference; unmatched deposits park in
 * the queue.
 */
export async function ingestDeposit(input: DepositInput): Promise<DepositView> {
  const existing = await db.deposit.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) {
    return toDepositView(existing);
  }

  // Match by narration/reference against a campaign's funding reference.
  const campaign = input.bankReference
    ? await db.campaign.findFirst({ where: { fundingReference: input.bankReference } })
    : null;

  const deposit = await db.deposit.create({
    data: {
      campaignId: campaign?.id ?? null,
      dedupeKey: input.dedupeKey,
      bankReference: input.bankReference ?? null,
      amountMinor: input.amountMinor,
      currency: input.currency ?? "NGN",
      senderHint: input.senderHint ?? null,
      matchedBy: campaign ? (input.matchedBy ?? "REFERENCE") : null,
      state: campaign ? "MATCHED" : "UNMATCHED",
    },
  });

  // Ledger move, committed with the deposit's classification.
  await db.$transaction(async (tx) => {
    if (campaign) {
      await recordDepositMatched(tx, {
        depositId: deposit.id,
        campaignId: campaign.id,
        amountMinor: input.amountMinor,
        currency: deposit.currency,
      });
    } else {
      await recordDepositUnmatched(tx, {
        depositId: deposit.id,
        amountMinor: input.amountMinor,
        currency: deposit.currency,
      });
    }
  });

  if (campaign) {
    await markCampaignFunded(campaign.id);
    await recordAudit({
      action: "deposit.matched",
      entityType: "Deposit",
      entityId: deposit.id,
      metadata: { campaignId: campaign.id, amountMinor: input.amountMinor.toString() },
    });
  } else {
    log("info", "deposit.unmatched", { deposit_id: deposit.id, bankReference: input.bankReference });
  }

  return toDepositView(deposit);
}

/** Manually resolve an unmatched deposit into a campaign's escrow. */
export async function matchDeposit(input: {
  depositId: string;
  campaignId: string;
  actorUserId: string;
  workspaceId: string;
}): Promise<DepositView> {
  const deposit = await db.deposit.findUnique({ where: { id: input.depositId } });
  if (!deposit) {
    throw notFound("Deposit not found.");
  }
  if (deposit.state === "MATCHED") {
    throw conflict("Deposit is already matched.");
  }

  const campaign = await db.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) {
    throw notFound("Campaign not found.");
  }

  const updated = await db.deposit.update({
    where: { id: deposit.id },
    data: { campaignId: campaign.id, state: "MATCHED", matchedBy: "MANUAL" },
  });

  // The deposit was parked in unmatched_deposits when it arrived. Move it from
  // there into this campaign's escrow -- a single move, so escrow is credited
  // exactly once.
  await db.$transaction(async (tx) => {
    await tx.journalEntry.create({
      data: {
        refType: "deposit",
        refId: deposit.id,
        debitAccount: "unmatched_deposits",
        creditAccount: `campaign_escrow:${campaign.id}`,
        amountMinor: deposit.amountMinor,
        currency: deposit.currency,
      },
    });
  });

  await markCampaignFunded(campaign.id);
  await recordAudit({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "deposit.matched.manual",
    entityType: "Deposit",
    entityId: deposit.id,
    metadata: { campaignId: campaign.id },
  });

  return toDepositView(updated);
}

/**
 * FundingSimulator (plan milestone 5): posts a synthetic deposit through the
 * same ingest path a real webhook uses, so the production code is exercised
 * end-to-end without bank access. Idempotent on the derived key.
 */
export async function simulateDeposit(input: {
  campaignId: string;
  workspaceId: string;
  amountMinor: Minor;
}): Promise<DepositView> {
  const campaign = await db.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) {
    throw notFound("Campaign not found.");
  }

  // Quote the campaign's funding reference so the deposit matches by narration.
  const fundingReference =
    campaign.fundingReference ?? (await getFundingInstructions(campaign.id, input.workspaceId)).fundingReference;

  return ingestDeposit({
    dedupeKey: `sim:${campaign.id}:${randomBytes(8).toString("hex")}`,
    bankReference: fundingReference,
    amountMinor: input.amountMinor,
    currency: campaign.currency,
    senderHint: "simulated",
    matchedBy: "SIMULATED",
  });
}

/** List deposits parked in the unmatched queue. */
export async function listUnmatchedDeposits(_workspaceId: string): Promise<DepositView[]> {
  // Unmatched deposits have no campaign link, so they cannot be scoped to a
  // workspace at the row level; operators see the global queue and resolve by
  // deposit id. (TODO: once Collection/virtual accounts exist, scope by pool.)
  const rows = await db.deposit.findMany({
    where: { state: "UNMATCHED" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toDepositView);
}

// --- internals --------------------------------------------------------------

async function markCampaignFunded(campaignId: string): Promise<void> {
  const escrow = await db.journalEntry.aggregate({
    _sum: { amountMinor: true },
    where: { creditAccount: `campaign_escrow:${campaignId}` },
  });
  if (escrow._sum.amountMinor && escrow._sum.amountMinor.gt(0)) {
    await db.campaign.updateMany({
      where: { id: campaignId, fundingStatus: { not: "FUNDED" } },
      data: { fundingStatus: "FUNDED" },
    });
  }
}

function toDepositView(row: {
  id: string;
  campaignId: string | null;
  bankReference: string | null;
  amountMinor: { toString(): string };
  state: string;
  matchedBy: string | null;
}): DepositView {
  return {
    id: row.id,
    campaignId: row.campaignId,
    bankReference: row.bankReference,
    amountMinor: row.amountMinor.toString(),
    state: row.state,
    matchedBy: row.matchedBy,
  };
}
