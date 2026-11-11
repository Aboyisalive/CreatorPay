/**
 * Payment provider seam.
 *
 * Platform code never touches Ecobank types. Every money-moving capability is
 * expressed as one of these provider methods, so the whole product runs against
 * `MockProvider` and swaps to `EcobankProvider` with a config flag. Where a
 * capability does not exist yet (real NUBAN account-name verification, which
 * needs Account Enquiry), the seam returns an honest "unverified" result
 * rather than guessing.
 *
 * Amounts are `Minor` (Prisma Decimal of integer kobo), matching the rest of
 * the backend, so there is no bigint/Decimal boundary conversion.
 */

import type { Minor } from "@/lib/money-server";

/** What a brand sees when funding a campaign. */
export type FundingInstructions = {
  /** Unique per campaign; the brand quotes it as the bank narration. */
  fundingReference: string;
  /** The account/display string shown to the brand (e.g. the pool account). */
  poolAccountDisplay: string;
  /** Optional expiry for the funding window. */
  expiresAt: string | null;
};

/**
 * Result of an account check.
 *
 * - `verified`: the bank confirmed the account name (needs Account Enquiry).
 * - `format_ok_unverified`: the account number is well-formed but unconfirmed.
 * - `invalid`: the account number is malformed.
 */
export type AccountCheck = {
  status: "verified" | "format_ok_unverified" | "invalid";
  accountName: string | null;
  reason: string | null;
};

/**
 * Result of a payout call or a payout status query.
 *
 * `state` is the provider's view; the ledger only moves on a confirmed
 * `settled`. A transfer acknowledgement is not settlement.
 */
export type PayoutResult = {
  /** Our idempotency key, minted and stored BEFORE the call. */
  requestId: string;
  /** The bank's transactionReference on success. */
  bankReference: string | null;
  state: "pending" | "settled" | "failed" | "unknown";
  /** The response body code (NOT the HTTP status -- the bank returns 200 on refusal). */
  rawCode: string | null;
};

export interface PaymentProvider {
  /** Brand-facing funding instructions for a campaign. */
  fundingInstructions(
    campaignId: string,
    amountMinor: Minor,
    currency: string,
  ): Promise<FundingInstructions>;

  /**
   * Verify a creator's bank account. The mock only checks NUBAN shape; the
   * real provider returns `format_ok_unverified` until Account Enquiry exists.
   */
  verifyAccount(accountNo: string, bankCode: string | null): Promise<AccountCheck>;

  /** Initiate a payout. MUST be idempotent on `requestId`. */
  payout(input: {
    accountNo: string;
    bankCode: string | null;
    amountMinor: Minor;
    currency: string;
    narration: string;
    requestId: string;
  }): Promise<PayoutResult>;

  /** Query the status of a previously submitted payout by bank reference. */
  payoutStatus(bankReference: string): Promise<PayoutResult>;
}
