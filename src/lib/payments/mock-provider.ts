import type { AccountCheck, FundingInstructions, PaymentProvider, PayoutResult } from "./types";
import { checkNuban } from "./nuban";
import type { Minor } from "@/lib/money-server";

/**
 * Scriptable mock payment rail.
 *
 * Every demo and test runs against this, so the product is fully functional
 * with zero Ecobank credentials. The behaviour of a payout is chosen by
 * scenario, mirroring the section 13 test matrix:
 *
 *   success             payout acknowledges (pending); settles on first status poll
 *   pending_then_success  stays pending for N polls, then settles
 *   failure             payout fails with a body code
 *   timeout             payout throws a transport error -> caller maps to unknown
 *   http200_error_body  bank returns HTTP 200 but a failure body code
 *   insufficient_balance  pool cannot cover the amount -> clean failure
 *
 * A payout call NEVER returns `settled` directly -- an acknowledgement is not
 * settlement. Settlement arrives via a status poll (or a webhook), exactly as
 * with the real rail.
 */

export type MockScenario =
  | "success"
  | "pending_then_success"
  | "failure"
  | "timeout"
  | "http200_error_body"
  | "insufficient_balance";

export const MOCK_SCENARIOS: readonly MockScenario[] = [
  "success",
  "pending_then_success",
  "failure",
  "timeout",
  "http200_error_body",
  "insufficient_balance",
];

/** Simulates a dropped connection / timeout. Callers map this to `unknown`. */
export class MockTransportError extends Error {
  constructor(message = "Mock transport timeout.") {
    super(message);
    this.name = "MockTransportError";
  }
}

type Options = {
  scenario?: MockScenario;
  /** How many status polls stay pending before settling (pending_then_success). */
  pendingPolls?: number;
  /** Display string shown to the brand as the funding destination. */
  poolAccountDisplay?: string;
};

export class MockProvider implements PaymentProvider {
  private readonly scenario: MockScenario;
  private readonly pendingPolls: number;
  private readonly poolAccountDisplay: string;
  private readonly polls = new Map<string, number>();

  constructor(options: Options = {}) {
    this.scenario = options.scenario ?? "success";
    this.pendingPolls = Math.max(1, options.pendingPolls ?? 2);
    this.poolAccountDisplay = options.poolAccountDisplay ?? "Ecobank Sandbox Pool ****0001";
  }

  async fundingInstructions(
    campaignId: string,
    _amountMinor: Minor,
    currency: string,
  ): Promise<FundingInstructions> {
    return {
      // The funding reference is minted by the platform, not the bank; here we
      // just echo a stable placeholder derived from the campaign id.
      fundingReference: `CP-${campaignId}`,
      poolAccountDisplay: `${this.poolAccountDisplay} (${currency})`,
      expiresAt: null,
    };
  }

  async verifyAccount(accountNo: string, _bankCode: string | null): Promise<AccountCheck> {
    // The mock has no bank, so it can never confirm a name -- only validate the
    // NUBAN shape. This deliberately exercises the honest `format_ok_unverified`
    // path the real provider also takes until Account Enquiry exists.
    const check = checkNuban(accountNo);
    if (!check.ok) {
      return { status: "invalid", accountName: null, reason: check.reason };
    }
    return { status: "format_ok_unverified", accountName: null, reason: "NUBAN shape valid (mock)." };
  }

  async payout(input: {
    requestId: string;
    amountMinor: Minor;
    // Unused by the mock; present to match the provider signature.
    accountNo: string;
    bankCode: string | null;
    currency: string;
    narration: string;
  }): Promise<PayoutResult> {
    switch (this.scenario) {
      case "timeout":
        throw new MockTransportError();

      case "failure":
        return { requestId: input.requestId, bankReference: null, state: "failed", rawCode: "001" };

      case "http200_error_body":
        // HTTP 200 but the body carries a refusal code. Only the body code is
        // trusted -- this is the trap the real integration warns about.
        return { requestId: input.requestId, bankReference: null, state: "failed", rawCode: "401" };

      case "insufficient_balance":
        return { requestId: input.requestId, bankReference: null, state: "failed", rawCode: "001" };

      case "success":
      case "pending_then_success":
      default:
        // Acknowledged only. Settlement comes from a later status poll.
        return {
          requestId: input.requestId,
          bankReference: this.bankReferenceFor(input.requestId),
          state: "pending",
          rawCode: "000",
        };
    }
  }

  async payoutStatus(bankReference: string): Promise<PayoutResult> {
    if (this.scenario === "failure" || this.scenario === "http200_error_body" || this.scenario === "insufficient_balance") {
      return { requestId: "", bankReference, state: "failed", rawCode: "001" };
    }
    if (this.scenario === "timeout") {
      // Status is how an unknown resolves; let it settle on the first poll.
      return { requestId: "", bankReference, state: "settled", rawCode: "000" };
    }

    const polls = (this.polls.get(bankReference) ?? 0) + 1;
    this.polls.set(bankReference, polls);

    const settledAfter = this.scenario === "success" ? 1 : this.pendingPolls;
    if (polls >= settledAfter) {
      return { requestId: "", bankReference, state: "settled", rawCode: "000" };
    }
    return { requestId: "", bankReference, state: "pending", rawCode: "000" };
  }

  private bankReferenceFor(requestId: string): string {
    return `MOCK-${requestId}`;
  }
}
