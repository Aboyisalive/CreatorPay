import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money-server";
import { setPaymentProvider, resetPaymentProvider } from "./provider";
import { MockProvider } from "./mock-provider";
import { initiatePayout, reconcilePayout, reconcileStalePayouts } from "./payout";
import { ingestDeposit } from "./funding";
import { escrowBalance, creatorPayableBalance } from "./ledger";

/**
 * End-to-end payout flow against the test-only fake provider (the product path
 * is 100% Ecobank; this fake exists only so the state machine and ledger are
 * provable without live calls). Covers the plan's core scenarios: happy path,
 * escrow gate, bank-details requirement, clean failure, and the in-progress
 * guard.
 */

const stamp = Date.now();
const VALID_NUBAN = "01234567891"; // passes the modulus-10 checksum

let creatorUserId: string;
let workspaceId: string;
let counter = 0;

async function seedScenario(opts: { fundMinor?: number; rewardMinor?: number; withBank?: boolean }) {
  const fundMinor = opts.fundMinor ?? 1_000_000;
  const rewardMinor = opts.rewardMinor ?? 750_000;
  const n = counter++;

  const creatorUser = await db.user.create({
    data: { email: `po-creator-${stamp}-${n}@creatorpay.test`, passwordHash: "x", name: "PO Creator" },
  });
  const profile = await db.creatorProfile.create({
    data: { userId: creatorUser.id, displayName: "PO Creator" },
  });
  if (opts.withBank !== false) {
    await db.creatorBankDetails.create({
      data: {
        creatorProfileId: profile.id,
        bankCode: "058",
        accountNo: VALID_NUBAN,
        accountNameConfirmed: "PO Creator",
        nubanOk: true,
      },
    });
  }

  const campaign = await db.campaign.create({
    data: {
      workspaceId,
      name: `PO campaign ${stamp}-${n}`,
      objectives: ["AWARENESS"],
      destinationUrl: "https://example.com",
      currency: "NGN",
      fundingReference: `CP-TEST-${stamp}-${n}`,
      fundingStatus: "AWAITING_FUNDS",
    },
  });

  if (fundMinor > 0) {
    // Fund escrow through the real ingest path (matches by funding reference).
    await ingestDeposit({
      dedupeKey: `po:${stamp}-${n}`,
      bankReference: campaign.fundingReference,
      amountMinor: toMinor(fundMinor),
      matchedBy: "SIMULATED",
    });
  }

  const termVersion = await db.campaignTermVersion.create({
    data: {
      campaignId: campaign.id,
      version: 1,
      snapshot: { objectives: ["AWARENESS"], policies: {} },
      publishedAt: new Date(),
    },
  });
  const participant = await db.campaignParticipant.create({
    data: {
      campaignId: campaign.id,
      creatorProfileId: profile.id,
      status: "ACTIVE",
      acceptedTermVersionId: termVersion.id,
      acceptedAt: new Date(),
    },
  });
  const reward = await db.rewardCalculation.create({
    data: {
      campaignId: campaign.id,
      participantId: participant.id,
      termVersionId: termVersion.id,
      version: 1,
      status: "APPROVED",
      currency: "NGN",
      totalMinor: toMinor(rewardMinor),
      breakdown: {},
    },
  });

  return { campaignId: campaign.id, rewardId: reward.id, creatorUserId: creatorUser.id, creatorProfileId: profile.id };
}

beforeEach(() => {
  resetPaymentProvider();
});

afterEach(() => {
  setPaymentProvider(null);
  resetPaymentProvider();
});

beforeAll(async () => {
  const owner = await db.user.create({
    data: { email: `po-owner-${stamp}@creatorpay.test`, passwordHash: "x", name: "PO Owner" },
  });
  creatorUserId = owner.id;
  const workspace = await db.workspace.create({
    data: {
      name: `PO WS ${stamp}`,
      slug: `po-ws-${stamp}`,
      memberships: { create: { userId: owner.id, role: "FINANCE" } },
    },
  });
  workspaceId = workspace.id;
});

afterAll(async () => {
  await db.journalEntry.deleteMany({
    where: {
      OR: [
        { debitAccount: { startsWith: "campaign_escrow:" } },
        { creditAccount: { startsWith: "campaign_escrow:" } },
        { debitAccount: { startsWith: "creator_payable:" } },
        { creditAccount: { startsWith: "creator_payable:" } },
        { creditAccount: "paid_out" },
        { debitAccount: "brand_funds_in_transit" },
      ],
    },
  });
  const campaigns = await db.campaign.findMany({ where: { workspaceId }, select: { id: true } });
  await db.rewardCalculation.deleteMany({ where: { campaignId: { in: campaigns.map((c) => c.id) } } });
  await db.deposit.deleteMany({ where: { campaignId: { in: campaigns.map((c) => c.id) } } });
  await db.campaign.deleteMany({ where: { workspaceId } });
  const profiles = await db.creatorProfile.findMany({ where: { user: { email: { contains: `po-creator-${stamp}` } } }, select: { id: true } });
  await db.creatorBankDetails.deleteMany({ where: { creatorProfileId: { in: profiles.map((p) => p.id) } } });
  await db.creatorProfile.deleteMany({ where: { id: { in: profiles.map((p) => p.id) } } });
  await db.user.deleteMany({ where: { email: { contains: `po-` } } });
  await db.workspace.delete({ where: { id: workspaceId } });
});

describe("payout flow", () => {
  it("credits escrow once and is idempotent on the deposit dedupeKey", async () => {
    const s = await seedScenario({ fundMinor: 0 }); // unfunded campaign
    const campaign = await db.campaign.findUnique({ where: { id: s.campaignId } });
    const ref = campaign!.fundingReference!;

    const d1 = await ingestDeposit({
      dedupeKey: `idem-${stamp}`,
      bankReference: ref,
      amountMinor: toMinor(100_000),
      matchedBy: "SIMULATED",
    });
    const d2 = await ingestDeposit({
      dedupeKey: `idem-${stamp}`,
      bankReference: ref,
      amountMinor: toMinor(100_000),
      matchedBy: "SIMULATED",
    });

    // Same dedupeKey returns the same row; escrow credited once, not twice.
    expect(d2.id).toBe(d1.id);
    expect((await escrowBalance(s.campaignId)).toString()).toBe("100000");
  });

  it("pays out end to end: escrow -> payable -> paid_out", async () => {
    setPaymentProvider(new MockProvider({ scenario: "success" }));
    const s = await seedScenario({ fundMinor: 1_000_000, rewardMinor: 750_000 });

    const payout = await initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId });
    expect(payout.state).toBe("PENDING"); // acknowledged, not settled
    expect(payout.bankReference).toMatch(/^MOCK-/);

    const rewardAfter = await db.rewardCalculation.findUnique({ where: { id: s.rewardId } });
    expect(rewardAfter?.status).toBe("PAYMENT_INITIATED");

    // escrow moved to creator payable; not yet paid out.
    expect((await escrowBalance(s.campaignId)).toString()).toBe("250000");
    expect((await creatorPayableBalance(s.creatorProfileId)).toString()).toBe("750000");

    // Reconcile -> settled. Status poll confirms; ledger moves payable -> paid_out.
    const settled = await reconcilePayout(payout.id, workspaceId);
    expect(settled.state).toBe("SETTLED");
    expect(settled.settledAt).toBeTruthy();

    const rewardFinal = await db.rewardCalculation.findUnique({ where: { id: s.rewardId } });
    expect(rewardFinal?.status).toBe("PAID");
    // Payable drained to zero for this creator (moved to paid_out).
    expect((await creatorPayableBalance(s.creatorProfileId)).toString()).toBe("0");
  });

  it("refuses to pay out an unfunded campaign (escrow gate)", async () => {
    setPaymentProvider(new MockProvider({ scenario: "success" }));
    const s = await seedScenario({ fundMinor: 0, rewardMinor: 750_000 });

    await expect(
      initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId }),
    ).rejects.toThrow(/Insufficient campaign escrow/);

    // No payout row was created and escrow is untouched.
    const payouts = await db.payout.count({ where: { rewardCalculationId: s.rewardId } });
    expect(payouts).toBe(0);
  });

  it("refuses to pay a creator with no bank details", async () => {
    setPaymentProvider(new MockProvider({ scenario: "success" }));
    const s = await seedScenario({ withBank: false });

    await expect(
      initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId }),
    ).rejects.toThrow(/no payout bank details/);
  });

  it("handles a clean failure without moving money to paid_out", async () => {
    setPaymentProvider(new MockProvider({ scenario: "failure" }));
    const s = await seedScenario({ fundMinor: 1_000_000, rewardMinor: 750_000 });

    const payout = await initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId });
    expect(payout.state).toBe("FAILED");
    expect(payout.rawCode).toBe("001");

    const rewardAfter = await db.rewardCalculation.findUnique({ where: { id: s.rewardId } });
    expect(rewardAfter?.status).toBe("PAYMENT_FAILED");

    // Creator stays payable; the payout row records the clean failure.
    expect((await creatorPayableBalance(s.creatorProfileId)).toString()).toBe("750000");
    const payoutRow = await db.payout.findUnique({ where: { id: payout.id } });
    expect(payoutRow?.state).toBe("FAILED");
  });

  it("blocks a second payout while one is in progress", async () => {
    setPaymentProvider(new MockProvider({ scenario: "pending_then_success", pendingPolls: 5 }));
    const s = await seedScenario({ fundMinor: 1_000_000, rewardMinor: 750_000 });

    await initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId });
    await expect(
      initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId }),
    ).rejects.toThrow(/already in progress/);
  });

  it("resolves a pending payout via the reconciliation sweep", async () => {
    setPaymentProvider(new MockProvider({ scenario: "success" }));
    const s = await seedScenario({ fundMinor: 1_000_000, rewardMinor: 750_000 });

    await initiatePayout({ rewardId: s.rewardId, actorUserId: creatorUserId, workspaceId });

    // The sweep polls stale pending payouts with a bank reference.
    const resolved = await reconcileStalePayouts(0);
    expect(resolved).toBeGreaterThanOrEqual(1);

    const rewardFinal = await db.rewardCalculation.findUnique({ where: { id: s.rewardId } });
    expect(rewardFinal?.status).toBe("PAID");
    expect((await creatorPayableBalance(s.creatorProfileId)).toString()).toBe("0");
  });
});
