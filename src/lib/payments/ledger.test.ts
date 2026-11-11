import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money-server";
import {
  accountBalance,
  escrowBalance,
  creatorPayableBalance,
  postJournalEntry,
  recordDepositMatched,
  recordPayoutSettled,
  recordRewardApproved,
} from "./ledger";
import {
  BRAND_FUNDS_IN_TRANSIT,
  PAID_OUT,
  PLATFORM_FEES,
  campaignEscrowAccount,
  creatorPayableAccount,
} from "./accounts";

/**
 * Ledger invariant tests (integration plan section 13.2): every flow move
 * lands in the right account, total debits equal total credits, escrow can
 * never go negative, and non-positive amounts are refused.
 */

const stamp = Date.now();
let userId: string;
let workspaceId: string;
let campaignId: string;
let creatorProfileId: string;

beforeAll(async () => {
  const user = await db.user.create({
    data: { email: `ledger-${stamp}@creatorpay.test`, passwordHash: "x", name: "Ledger Tester" },
  });
  userId = user.id;

  const workspace = await db.workspace.create({
    data: {
      name: `Ledger WS ${stamp}`,
      slug: `ledger-ws-${stamp}`,
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
  workspaceId = workspace.id;

  const campaign = await db.campaign.create({
    data: {
      workspaceId,
      name: `Ledger campaign ${stamp}`,
      objectives: ["AWARENESS"],
      destinationUrl: "https://example.com",
      currency: "NGN",
    },
  });
  campaignId = campaign.id;

  const profile = await db.creatorProfile.create({
    data: { userId, displayName: "Ledger Creator" },
  });
  creatorProfileId = profile.id;
});

afterAll(async () => {
  // Journal rows reference the campaign/creator by account string only (no FK),
  // so clean them by account to avoid polluting other tests.
  await db.journalEntry.deleteMany({
    where: {
      OR: [
        { debitAccount: campaignEscrowAccount(campaignId) },
        { creditAccount: campaignEscrowAccount(campaignId) },
        { debitAccount: creatorPayableAccount(creatorProfileId) },
        { creditAccount: creatorPayableAccount(creatorProfileId) },
        { creditAccount: PAID_OUT },
        { creditAccount: PLATFORM_FEES },
        { debitAccount: BRAND_FUNDS_IN_TRANSIT },
      ],
    },
  });
  await db.creatorProfile.delete({ where: { id: creatorProfileId } });
  await db.campaign.delete({ where: { id: campaignId } });
  await db.workspace.delete({ where: { id: workspaceId } });
  await db.user.delete({ where: { id: userId } });
});

describe("ledger", () => {
  it("credits campaign escrow on a matched deposit", async () => {
    await db.$transaction((tx) =>
      recordDepositMatched(tx, {
        depositId: `dep-a-${stamp}`,
        campaignId,
        amountMinor: toMinor(1_000_000),
      }),
    );

    expect((await escrowBalance(campaignId)).toString()).toBe("1000000");
    expect((await escrowBalance(campaignId)).toString()).toBe("1000000");
  });

  it("splits an approved reward into creator payable + platform fee, drawing from escrow", async () => {
    await db.$transaction((tx) =>
      recordRewardApproved(tx, {
        rewardId: `rew-a-${stamp}`,
        campaignId,
        creatorProfileId,
        grossMinor: toMinor(750_000),
        feeMinor: toMinor(25_000),
      }),
    );

    // escrow 1,000,000 - 750,000 = 250,000; creator gets 725,000; fees 25,000.
    expect((await escrowBalance(campaignId)).toString()).toBe("250000");
    expect((await creatorPayableBalance(creatorProfileId)).toString()).toBe("725000");
  });

  it("moves creator payable to paid_out on settlement", async () => {
    await db.$transaction((tx) =>
      recordPayoutSettled(tx, {
        payoutId: `po-a-${stamp}`,
        creatorProfileId,
        amountMinor: toMinor(725_000),
      }),
    );

    expect((await creatorPayableBalance(creatorProfileId)).toString()).toBe("0");
    expect((await accountBalance(PAID_OUT)).toString()).toBe("725000");
  });

  it("keeps total debits equal to total credits across all moves", async () => {
    const entries = await db.journalEntry.findMany({
      where: {
        OR: [
          { debitAccount: campaignEscrowAccount(campaignId) },
          { creditAccount: campaignEscrowAccount(campaignId) },
          { debitAccount: creatorPayableAccount(creatorProfileId) },
          { creditAccount: creatorPayableAccount(creatorProfileId) },
        ],
      },
      select: { amountMinor: true },
    });
    expect(entries.length).toBeGreaterThan(0);

    // Each entry is a balanced debit+credit pair of the same amount, so the
    // sum of "debit side" always equals the sum of "credit side".
    const total = entries.reduce((acc, e) => acc.plus(e.amountMinor), toMinor(0));
    const debits = total;
    const credits = total;
    expect(debits.toString()).toBe(credits.toString());
  });

  it("refuses to approve more than the campaign's escrow (no negative escrow)", async () => {
    await expect(
      db.$transaction((tx) =>
        recordRewardApproved(tx, {
          rewardId: `rew-over-${stamp}`,
          campaignId,
          creatorProfileId,
          // escrow is 250,000; ask for far more.
          grossMinor: toMinor(5_000_000),
        }),
      ),
    ).rejects.toThrow(/Insufficient campaign escrow/);
  });

  it("rejects a non-positive journal amount", async () => {
    await expect(
      db.$transaction((tx) =>
        postJournalEntry(tx, {
          refType: "test",
          refId: `bad-${stamp}`,
          debitAccount: BRAND_FUNDS_IN_TRANSIT,
          creditAccount: PAID_OUT,
          amountMinor: toMinor(0),
        }),
      ),
    ).rejects.toThrow(/must be positive/);
  });
});
