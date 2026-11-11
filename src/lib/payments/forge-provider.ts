import type { PaymentsConfig } from "./config";
import { log } from "@/lib/logging";
import { db } from "@/lib/db";
import type { Minor } from "@/lib/money-server";
import { formatAmountMinor } from "./signing";
import { toNipCode, XTRADOT_NIP_CODE } from "./forge-banks";
import type { AccountCheck, FundingInstructions, PaymentProvider, PayoutResult } from "./types";

/**
 * Access Youth Tech Forge 2026: Xtradot Bank sandbox rail.
 *
 * Contract: docs/Forge_2026_Sandbox_Participant_Platform_Guide.pdf section 5.
 * The sandbox is only reachable from inside the team's cluster namespace, with
 * header `x-api-key: <team key>`.
 *
 * Rules enforced here (all assessed per the guide):
 *  - Every transfer is name enquiry, then transfer with the single-use
 *    `name_enquiry_ref`.
 *  - `Idempotency-Key` on every transfer. We use our own `requestId`.
 *  - On 504 TIMEOUT (or any unknown outcome) NEVER resend. Return `unknown`
 *    and let status polling resolve it by `reference`.
 *  - Before enquiring, look the reference up: a retried payout must not send a
 *    second transfer (a new enquiry ref changes the body, so the same
 *    Idempotency-Key would 409 instead of replaying).
 *  - Charges are read from the response, never hard-coded.
 *
 * Response field names beyond those printed in the guide (`status`, `data`,
 * `name_enquiry_ref`, `fee`, `vat`, `stamp_duty`, `total_debit`) are read
 * defensively and flagged TODO(forge-shape); verify against a live call.
 */

const REQUEST_TIMEOUT_MS = 25_000; // gateway times out at 30 s

type Envelope = {
  status?: string;
  data?: Record<string, unknown> | null;
  error?: { code?: string; message?: string; field?: string };
  request_id?: string;
};

type Call = { http: number; body: Envelope; networkError: boolean };

export class ForgeProvider implements PaymentProvider {
  private readonly config: PaymentsConfig;

  constructor(config: PaymentsConfig) {
    this.config = config;
  }

  async fundingInstructions(
    campaignId: string,
    _amountMinor: Minor,
    _currency: string,
  ): Promise<FundingInstructions> {
    // TODO(forge-virtual-accounts): POST /virtual-accounts would give one
    // account per campaign, but the guide does not print its request body
    // (Sandbox API Mock Specification v2 does). Until then funding is a
    // transfer into the pool account quoted by the campaign reference.
    return {
      fundingReference: `CP-${campaignId}`,
      poolAccountDisplay: `Xtradot Bank ${this.config.forgeSourceAccount}`,
      expiresAt: null,
    };
  }

  async verifyAccount(accountNo: string, bankCode: string | null): Promise<AccountCheck> {
    if (!/^\d{10,11}$/.test(accountNo)) {
      return { status: "invalid", accountName: null, reason: "Account number must be 10 or 11 digits." };
    }
    const nip = toNipCode(bankCode);
    if (!nip) {
      return {
        status: "format_ok_unverified",
        accountName: null,
        reason: "Bank not supported by the sandbox; name not confirmed.",
      };
    }

    const enquiry = await this.nameEnquiry(nip, accountNo, `verify-${accountNo}`);
    if (enquiry.ok) {
      return { status: "verified", accountName: enquiry.accountName, reason: null };
    }
    if (enquiry.code === "ACCOUNT_NOT_FOUND") {
      return { status: "invalid", accountName: null, reason: "Account not found at that bank." };
    }
    if (enquiry.code === "ACCOUNT_DORMANT" || enquiry.code === "BENEFICIARY_FROZEN") {
      return { status: "invalid", accountName: null, reason: "Account cannot receive funds." };
    }
    // Rate limit, timeout, bank down: we could not check. Honest unverified.
    return {
      status: "format_ok_unverified",
      accountName: null,
      reason: `Name enquiry unavailable (${enquiry.code}).`,
    };
  }

  async payout(input: {
    accountNo: string;
    bankCode: string | null;
    amountMinor: Minor;
    currency: string;
    narration: string;
    requestId: string;
  }): Promise<PayoutResult> {
    const reference = input.requestId;
    const nip = toNipCode(input.bankCode);
    if (!nip) {
      return failed(reference, "BANK_UNSUPPORTED");
    }

    // 1. Replay guard: a retried payout resumes instead of resending.
    const prior = await this.lookup(reference);
    if (prior) return prior;

    // 2. Name enquiry (single-use ref, expires in 10 min). Nothing has been
    //    sent yet, so any failure here is a clean failure.
    const enquiry = await this.nameEnquiry(nip, input.accountNo, reference);
    if (!enquiry.ok) {
      return failed(reference, enquiry.code);
    }

    // 3. Transfer.
    const intra = nip === XTRADOT_NIP_CODE;
    const path = intra ? "/transfers/intra" : "/transfers/interbank";
    const call = await this.request("POST", path, {
      requestId: reference,
      idempotencyKey: reference,
      body: {
        source_account: this.config.forgeSourceAccount,
        destination_bank_code: nip,
        destination_account: input.accountNo,
        name_enquiry_ref: enquiry.ref,
        amount: Number(formatAmountMinor(input.amountMinor)),
        narration: input.narration,
        reference,
      },
    });

    // Outcome unknown (timeout, network, 5xx): NEVER resend.
    if (call.networkError || call.http === 504 || call.http >= 500) {
      if (call.http === 503 && call.body.error?.code === "BANK_UNAVAILABLE") {
        return failed(reference, "BANK_UNAVAILABLE");
      }
      return { requestId: reference, bankReference: reference, state: "unknown", rawCode: codeOf(call) };
    }
    if (call.http === 201 || call.http === 202 || call.http === 200) {
      // A 201/200 (intra) is complete in the call; interbank 202 settles in ~5 s.
      // Still confirm by status poll before the ledger moves (ack != settlement).
      return {
        requestId: reference,
        bankReference: reference,
        state: mapStatus(statusOf(call.body)) === "failed" ? "failed" : "pending",
        rawCode: statusOf(call.body) ?? String(call.http),
      };
    }
    // 4xx: INSUFFICIENT_FUNDS, LIMIT_EXCEEDED, DUPLICATE_REQUEST, ... Nothing moved.
    return failed(reference, codeOf(call));
  }

  async payoutStatus(bankReference: string): Promise<PayoutResult> {
    const result = await this.lookup(bankReference);
    // Not found / unreadable: outcome still unknown, never assume failure.
    return result ?? { requestId: bankReference, bankReference, state: "unknown", rawCode: "STATUS_UNAVAILABLE" };
  }

  // --- internals -------------------------------------------------------------

  /** GET /transfers/{reference}. Null when the bank has no such transfer. */
  private async lookup(reference: string): Promise<PayoutResult | null> {
    const call = await this.request("GET", `/transfers/${encodeURIComponent(reference)}`, {
      requestId: reference,
    });
    if (call.http === 404) return null;
    if (call.networkError || call.http !== 200) {
      // Cannot tell whether it exists. Refuse to proceed rather than risk a
      // double debit: surface as unknown.
      return { requestId: reference, bankReference: reference, state: "unknown", rawCode: codeOf(call) };
    }
    const status = statusOf(call.body);
    return {
      requestId: reference,
      bankReference: reference,
      state: mapStatus(status),
      rawCode: status,
    };
  }

  private async nameEnquiry(
    nip: string,
    accountNo: string,
    requestId: string,
  ): Promise<{ ok: true; ref: string; accountName: string | null } | { ok: false; code: string }> {
    const intra = nip === XTRADOT_NIP_CODE;
    const call = await this.request(
      "POST",
      intra ? "/transfers/intra/name-enquiry" : "/transfers/interbank/name-enquiry",
      {
        requestId,
        body: intra
          ? { account_number: accountNo }
          : { destination_bank_code: nip, account_number: accountNo },
      },
    );
    if (call.http >= 200 && call.http < 300) {
      const data = call.body.data ?? {};
      const ref = data.name_enquiry_ref;
      if (typeof ref === "string" && ref) {
        // TODO(forge-shape): confirm the resolved-name field. Guide only says
        // "display the resolved name"; account_name is the likely key.
        const name = data.account_name ?? data.accountName ?? data.name;
        return { ok: true, ref, accountName: typeof name === "string" ? name : null };
      }
      return { ok: false, code: "NAME_ENQUIRY_NO_REF" };
    }
    return { ok: false, code: codeOf(call) };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    opts: { requestId: string; idempotencyKey?: string; body?: Record<string, unknown> },
  ): Promise<Call> {
    const headers: Record<string, string> = {
      "x-api-key": this.config.forgeApiKey,
      Accept: "application/json",
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

    const started = Date.now();
    let http = 0;
    let body: Envelope = {};
    let networkError = false;
    try {
      const res = await fetch(`${this.config.forgeBaseUrl}${path}`, {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      http = res.status;
      body = (await res.json().catch(() => ({}))) as Envelope;
    } catch (error) {
      networkError = true;
      log("warn", "forge.network_error", { request_id: opts.requestId, path, error: String(error) });
    }

    await this.recordCall(opts.requestId, `${method} ${path}`, body, http, Date.now() - started);
    return { http, body, networkError };
  }

  /** Audit the call. Never stores request bodies or the API key. */
  private async recordCall(
    requestId: string,
    endpoint: string,
    body: Envelope,
    httpStatus: number,
    durationMs: number,
  ): Promise<void> {
    const responseCode = body.error?.code ?? body.status ?? null;
    log("info", "forge.call", {
      request_id: requestId,
      endpoint,
      response_code: responseCode,
      http_status: httpStatus,
      duration_ms: durationMs,
      forge_request_id: body.request_id ?? null,
    });
    try {
      await db.providerCall.create({
        data: { requestId, endpoint, provider: "forge", responseCode, httpStatus, durationMs },
      });
    } catch (error) {
      // Audit failure must never change the money outcome.
      log("warn", "forge.audit_error", { request_id: requestId, error: String(error) });
    }
  }
}

// --- parsing -----------------------------------------------------------------

function failed(requestId: string, rawCode: string): PayoutResult {
  return { requestId, bankReference: null, state: "failed", rawCode };
}

function codeOf(call: Call): string {
  if (call.networkError) return "NETWORK_ERROR";
  return call.body.error?.code ?? `HTTP_${call.http}`;
}

function statusOf(body: Envelope): string | null {
  // TODO(forge-shape): transfer state is expected at data.status
  // (successful|failed|pending|reversed, per x-test-outcome and webhook names).
  const raw = body.data?.status ?? null;
  return typeof raw === "string" ? raw : null;
}

/** Only an explicit success settles; unrecognised stays pending. */
export function mapStatus(status: string | null): "settled" | "failed" | "pending" {
  const value = (status ?? "").trim().toLowerCase();
  if (["successful", "success", "completed"].includes(value)) return "settled";
  if (["failed", "reversed", "rejected"].includes(value)) return "failed";
  return "pending";
}
