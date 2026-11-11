import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ZERO_MINOR, type Minor } from "@/lib/money-server";
import { conflict } from "@/lib/errors";
import { formatMinor } from "@/lib/format";
import {
  BRAND_FUNDS_IN_TRANSIT,
  PAID_OUT,
  PLATFORM_FEES,
  UNMATCHED_DEPOSITS,
  campaignEscrowAccount,
  creatorPayableAccount,
} from "./accounts";

/**
 * Double-entry ledger.
 *
 * The ledger is the source of truth for money movement -- Ecobank is just the
 * rail. Every movement is a single balanced debit+credit pair written as one
 * append-only `JournalEntry` row, so total debits always equal total credits.
 * Rows are never updated or deleted; a correction is a new entry.
 *
 * Flow (integration plan section 10.2):
 *   1. deposit matched:          brand_funds_in_transit -> campaign_escrow
 *   2. reward approved:          campaign_escrow -> creator_payable (+ platform_fees)
 *   3. payout submitted:         state change only (no ledger move)
 *   4. payout settled:           creator_payable -> paid_out
 *   5. payout failed:            no ledger move, creator stays payable
 *   6. deposit unmatched:        brand_funds_in_transit -> unmatched_deposits
 *
 * These helpers take a `Prisma.TransactionClient` so a ledger move can be
 * committed atomically with the domain state change that caused it.
 */

type Tx = Prisma.TransactionClient;

export type JournalMove = {
  refType: string;
  refId: string;
  debitAccount: string;
  creditAccount: string;
  amountMinor: Minor;
  currency?: string;
};

/** Append one balanced entry. Amount must be strictly positive. */
export async function postJournalEntry(tx: Tx, move: JournalMove): Promise<void> {
  if (move.amountMinor.lte(ZERO_MINOR)) {
    throw new Error(
      `Journal amount must be positive (got ${move.amountMinor.toString()}) for ${move.refType}:${move.refId}`,
    );
  }
  await tx.journalEntry.create({
    data: {
      refType: move.refType,
      refId: move.refId,
      debitAccount: move.debitAccount,
      creditAccount: move.creditAccount,
      amountMinor: move.amountMinor,
      currency: move.currency ?? "NGN",
    },
  });
}

/**
 * Balance of one account = credits - debits. Escrow and payable are
 * credit-normal: funding credits them, spending debits them, and a positive
 * result is the amount still available.
 */
export async function accountBalance(account: string): Promise<Minor> {
  const entries = await db.journalEntry.findMany({
    where: { OR: [{ debitAccount: account }, { creditAccount: account }] },
    select: { debitAccount: true, creditAccount: true, amountMinor: true },
  });

  let balance = new Prisma.Decimal(0);
  for (const entry of entries) {
    if (entry.creditAccount === account) {
      balance = balance.plus(entry.amountMinor);
    }
    if (entry.debitAccount === account) {
      balance = balance.minus(entry.amountMinor);
    }
  }
  return balance;
}

/** Funds still held in a campaign's escrow. */
export async function escrowBalance(campaignId: string): Promise<Minor> {
  return accountBalance(campaignEscrowAccount(campaignId));
}

/** Amount still owed to a creator and not yet paid out. */
export async function creatorPayableBalance(creatorProfileId: string): Promise<Minor> {
  return accountBalance(creatorPayableAccount(creatorProfileId));
}

// --- Flow moves -------------------------------------------------------------

/** 1. A deposit matched to a campaign credits its escrow. */
export async function recordDepositMatched(
  tx: Tx,
  input: { depositId: string; campaignId: string; amountMinor: Minor; currency?: string },
): Promise<void> {
  await postJournalEntry(tx, {
    refType: "deposit",
    refId: input.depositId,
    debitAccount: BRAND_FUNDS_IN_TRANSIT,
    creditAccount: campaignEscrowAccount(input.campaignId),
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
}

/** 6. An unmatched deposit parks in the unmatched queue. */
export async function recordDepositUnmatched(
  tx: Tx,
  input: { depositId: string; amountMinor: Minor; currency?: string },
): Promise<void> {
  await postJournalEntry(tx, {
    refType: "deposit",
    refId: input.depositId,
    debitAccount: BRAND_FUNDS_IN_TRANSIT,
    creditAccount: UNMATCHED_DEPOSITS,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
}

/**
 * 2. An approved reward moves its gross out of escrow: the net to the creator's
 * payable and the platform fee to platform_fees. Throws if escrow cannot cover
 * the gross, so we can never approve more than the campaign funded.
 */
export async function recordRewardApproved(
  tx: Tx,
  input: {
    rewardId: string;
    campaignId: string;
    creatorProfileId: string;
    grossMinor: Minor;
    feeMinor?: Minor;
    currency?: string;
  },
): Promise<void> {
  const fee = input.feeMinor ?? ZERO_MINOR;
  if (fee.gt(input.grossMinor)) {
    throw new Error("Platform fee cannot exceed the reward gross.");
  }
  const net = input.grossMinor.minus(fee);

  const available = await escrowBalance(input.campaignId);
  if (available.lt(input.grossMinor)) {
    throw conflict(
      `Insufficient campaign escrow: ${formatMinor(available.toString(), input.currency)} funded, ${formatMinor(input.grossMinor.toString(), input.currency)} needed. Fund the campaign first.`,
    );
  }

  // Gross leaves escrow; net lands in creator payable.
  await postJournalEntry(tx, {
    refType: "reward",
    refId: input.rewardId,
    debitAccount: campaignEscrowAccount(input.campaignId),
    creditAccount: creatorPayableAccount(input.creatorProfileId),
    amountMinor: net,
    currency: input.currency,
  });

  // Fee (if any) leaves escrow to platform fees.
  if (fee.gt(ZERO_MINOR)) {
    await postJournalEntry(tx, {
      refType: "reward",
      refId: input.rewardId,
      debitAccount: campaignEscrowAccount(input.campaignId),
      creditAccount: PLATFORM_FEES,
      amountMinor: fee,
      currency: input.currency,
    });
  }
}

/** 4. A settled payout moves the creator's payable to paid_out. */
export async function recordPayoutSettled(
  tx: Tx,
  input: { payoutId: string; creatorProfileId: string; amountMinor: Minor; currency?: string },
): Promise<void> {
  await postJournalEntry(tx, {
    refType: "payout",
    refId: input.payoutId,
    debitAccount: creatorPayableAccount(input.creatorProfileId),
    creditAccount: PAID_OUT,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
}
