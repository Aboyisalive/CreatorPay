import type { PaymentsConfig } from "./config";
import { log } from "@/lib/logging";
import { db } from "@/lib/db";
import type { Minor } from "@/lib/money-server";
import { checkNuban } from "./nuban";
import { signRequest, domesticTransferTail, statusTail, tokenTail, transferAmount, type SigningHeader } from "./signing";
import type { AccountCheck, FundingInstructions, PaymentProvider, PayoutResult } from "./types";

/**
 * The real Ecobank rail (UAT sandbox).
 *
 * Every network call is signed per section 11 (SHA-512, secret appended, NOT
 * HMAC), times its duration, and records a redacted `ProviderCall` audit row.
 * The response BODY code decides success/failure -- never the HTTP status,
 * because the bank is reported to return HTTP 200 on refusals.
 *
 * Several request fields are community-documented and not yet confirmed against
 * the real API definition (see integration plan section 15). They are isolated
 * below and flagged TODO so reconciling them is a one-place change. This
 * provider is only constructed when `PAYMENT_PROVIDER=ecobank` and every
 * credential is present (see config.assertEcobankConfigured).
 */

// Request types and service code as measured against the UAT gateway by the
// community Local Bank Payment client (github.com/Fath57/izy-ecobank-payout).
// Ecobank's public docs don't publish them; env vars override, and `||` makes
// blank values in .env fall back to these defaults.
const TOKEN_SERVICE_CODE = process.env.ECOBANK_SERVICE_CODE_TOKEN || "DOMESTIC";
const TOKEN_REQUEST_TYPE = process.env.ECOBANK_REQUEST_TYPE_TOKEN || "GET_API_TOKEN";
const PAYMENT_REQUEST_TYPE = process.env.ECOBANK_REQUEST_TYPE_PAYMENT || "DOMESTIC_TRANSFER";
const STATUS_REQUEST_TYPE = process.env.ECOBANK_REQUEST_TYPE_STATUS || "TRANSACTION_STATUS";

/** The bank rejects descriptions shorter than 5 characters. */
const MIN_DESCRIPTION = 5;

const TOKEN_URL = "/corp-auth/api/v2/integration/auth/app/token";
const DOMESTIC_URL = "/corp-payment/api/v2/payment/domestic";
const STATUS_URL = "/corp-payment/api/v2/integration/payment/status";

/** Documented as ~5 min (observed ~5 h); used when the response omits expires_in. */
const TOKEN_TTL_MS = 3 * 60 * 1000;

type CachedToken = { value: string; expiresAt: number };

export class EcobankProvider implements PaymentProvider {
  private readonly config: PaymentsConfig;
  private token: CachedToken | null = null;
  private tokenInFlight: Promise<string> | null = null;

  constructor(config: PaymentsConfig) {
    this.config = config;
  }

  async fundingInstructions(
    campaignId: string,
    _amountMinor: Minor,
    currency: string,
  ): Promise<FundingInstructions> {
    // No account-enquiry or virtual-account API is available, so funding is a
    // manual bank transfer into the pool account quoted by the narration.
    return {
      fundingReference: `CP-${campaignId}`,
      poolAccountDisplay: `Ecobank UAT Pool (${currency})`,
      expiresAt: null,
    };
  }

  async verifyAccount(accountNo: string, _bankCode: string | null): Promise<AccountCheck> {
    // Account Enquiry is not subscribed, so we can only validate the NUBAN
    // shape and never confirm a name. Honest `format_ok_unverified`.
    const check = checkNuban(accountNo);
    if (!check.ok) {
      return { status: "invalid", accountName: null, reason: check.reason };
    }
    return {
      status: "format_ok_unverified",
      accountName: null,
      reason: "NUBAN shape valid; name not confirmed (Account Enquiry unavailable).",
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
    const amount = transferAmount(input.amountMinor);
    const description = input.narration.padEnd(MIN_DESCRIPTION, ".");
    const header = this.header(input.requestId, PAYMENT_REQUEST_TYPE);

    // TODO(integration): reconcile the exact body field set/order and the bank
    // code representation against the downloaded API definition. The hash tail
    // below is authoritative (receiverAccountNo, amountString, currency,
    // description); the JSON body must carry the same values by name.
    const { requestToken, secureHash } = signRequest(
      header,
      this.config.secretKey,
      domesticTransferTail({
        receiverAccountNo: input.accountNo,
        amount: amount.text,
        currency: input.currency,
        description,
      }),
    );

    const body = {
      // Auth fields are nested under `headerRequest` (with `requestToken`),
      // and `secureHash` sits as a top-level sibling -- matching the real UAT
      // sandbox payload. The payment fields are top-level.
      headerRequest: {
        affiliateCode: this.config.affiliateCode,
        clientId: this.config.clientId,
        sourceCode: this.config.sourceCode,
        requestId: header.requestId,
        requestType: header.requestType,
        ipAddress: header.ipAddress,
        requestToken,
      },
      secureHash,
      receiverAccountNo: input.accountNo,
      // The debit account is normally the pool tied to clientId; only send an
      // explicit source account when one is configured.
      ...(this.config.sourceAccountNo ? { sourceAccountNo: this.config.sourceAccountNo } : {}),
      amount: amount.value,
      currency: input.currency,
      description,
    };

    const response = await this.post(DOMESTIC_URL, body, input.requestId);
    const rawCode = readResponseCode(response.json);

    if (rawCode === "000") {
      const bankReference = readTransactionReference(response.json);
      // Acknowledged only. Settlement is confirmed by a later status poll.
      return { requestId: input.requestId, bankReference, state: "pending", rawCode };
    }
    return { requestId: input.requestId, bankReference: null, state: "failed", rawCode };
  }

  async payoutStatus(bankReference: string): Promise<PayoutResult> {
    const requestId = `status-${bankReference}`;
    const header = this.header(requestId, STATUS_REQUEST_TYPE);
    const { requestToken, secureHash } = signRequest(
      header,
      this.config.secretKey,
      statusTail(bankReference),
    );

    const body = {
      // TODO(integration): status payload shape inferred; confirm against the
      // API definition. The status call keys on the bank's transactionReference.
      headerRequest: {
        affiliateCode: this.config.affiliateCode,
        clientId: this.config.clientId,
        sourceCode: this.config.sourceCode,
        requestId: header.requestId,
        requestType: header.requestType,
        ipAddress: header.ipAddress,
        requestToken,
      },
      secureHash,
      transactionReference: bankReference,
    };

    const response = await this.post(STATUS_URL, body, requestId);
    const rawCode = readResponseCode(response.json);

    if (rawCode !== "000") {
      // The status call itself failed; the transfer's outcome is still unknown.
      return { requestId, bankReference, state: "pending", rawCode };
    }
    // A 000 only means the query succeeded -- the transfer state is data.status.
    return { requestId, bankReference, state: mapTransferStatus(readTransferStatus(response.json)), rawCode };
  }

  // --- internals -------------------------------------------------------------

  private header(requestId: string, requestType: string): SigningHeader {
    return {
      clientId: this.config.clientId,
      affiliateCode: this.config.affiliateCode,
      sourceCode: this.config.sourceCode,
      requestId,
      requestType,
      ipAddress: this.config.ipAddress,
    };
  }

  /** Mint (or reuse) the bearer token, deduping concurrent mints. */
  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.value;
    }
    this.tokenInFlight ??= this.mintToken().finally(() => {
      this.tokenInFlight = null;
    });
    return this.tokenInFlight;
  }

  private async mintToken(): Promise<string> {
    const requestId = `token-${Date.now()}`;
    const header = this.header(requestId, TOKEN_REQUEST_TYPE);
    const { requestToken, secureHash } = signRequest(
      header,
      this.config.secretKey,
      tokenTail({ publicKey: this.config.publicKey, serviceCode: TOKEN_SERVICE_CODE }),
    );

    const body = {
      // TODO(integration): token payload shape inferred from the
      // domestic-transfer structure; confirm against the auth API definition.
      headerRequest: {
        affiliateCode: this.config.affiliateCode,
        clientId: this.config.clientId,
        sourceCode: this.config.sourceCode,
        requestId: header.requestId,
        requestType: header.requestType,
        ipAddress: header.ipAddress,
        requestToken,
      },
      secureHash,
      publicKey: this.config.publicKey,
      serviceCode: TOKEN_SERVICE_CODE,
    };

    const response = await this.post(TOKEN_URL, body, requestId, /* withAuth */ false);
    const rawCode = readResponseCode(response.json);
    if (rawCode !== "000") {
      throw new Error(`Ecobank token mint failed (code ${rawCode ?? "unknown"}).`);
    }
    const value = readToken(response.json);
    if (!value) {
      throw new Error("Ecobank token response did not contain an access token.");
    }
    const expiresIn = readExpiresIn(response.json);
    const ttl = expiresIn ? Math.max(30_000, expiresIn * 1000 - 60_000) : TOKEN_TTL_MS;
    this.token = { value, expiresAt: Date.now() + ttl };
    return value;
  }

  /**
   * POST with signing headers, timing, and a redacted `ProviderCall` audit.
   * A 401 drops the cached token and retries once (section 11 token behavior).
   */
  private async post(
    path: string,
    body: Record<string, unknown>,
    requestId: string,
    withAuth = true,
    isRetry = false,
  ): Promise<{ json: Record<string, unknown>; httpStatus: number }> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "Ocp-Apim-Subscription-Key": this.config.keyCore,
    };
    // When ECOBANK_BASE_URL points at our fixed-IP proxy, prove the call is ours
    // so the proxy isn't an open relay. The proxy strips this before forwarding.
    if (process.env.ECOBANK_PROXY_KEY) {
      headers["X-Proxy-Key"] = process.env.ECOBANK_PROXY_KEY;
    }
    if (withAuth) {
      headers.Authorization = `Bearer ${await this.accessToken()}`;
    }

    const started = Date.now();
    let httpStatus = 0;
    let json: Record<string, unknown> = {};
    try {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      httpStatus = res.status;
      json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      // Expired tokens come back as 403 (observed), bad ones as 401: drop the
      // token and retry once with a fresh one.
      if ((httpStatus === 401 || httpStatus === 403) && withAuth && !isRetry) {
        this.token = null;
        return this.post(path, body, requestId, withAuth, true);
      }
    } finally {
      await this.recordCall(requestId, path, readResponseCode(json), httpStatus, Date.now() - started);
    }

    return { json, httpStatus };
  }

  /** Audit the call. Never stores the request body (which holds the hash). */
  private async recordCall(
    requestId: string,
    endpoint: string,
    responseCode: string | null,
    httpStatus: number,
    durationMs: number,
  ): Promise<void> {
    log("info", "ecobank.call", {
      request_id: requestId,
      endpoint,
      response_code: responseCode,
      http_status: httpStatus,
      duration_ms: durationMs,
    });
    await db.providerCall.create({
      data: { requestId, endpoint, provider: "ecobank", responseCode, httpStatus, durationMs },
    });
  }
}

// --- response parsing (community shapes; TODO reconcile with API definition) --

function readResponseCode(json: Record<string, unknown>): string | null {
  const nested = json.headerResponse as Record<string, unknown> | undefined;
  const code = nested?.responseCode ?? json.responseCode ?? json.code;
  return code == null ? null : String(code);
}

function dataOf(json: Record<string, unknown>): Record<string, unknown> {
  return (json.data as Record<string, unknown> | undefined) ?? {};
}

function readTransactionReference(json: Record<string, unknown>): string | null {
  const data = dataOf(json);
  const ref = data.transactionReference ?? json.transactionReference ?? json.transactionRef ?? json.reference;
  return ref == null ? null : String(ref);
}

function readToken(json: Record<string, unknown>): string | null {
  const data = dataOf(json);
  const token = data.access_token ?? data.accessToken ?? json.access_token ?? json.accessToken ?? json.token;
  return token == null ? null : String(token);
}

function readExpiresIn(json: Record<string, unknown>): number | null {
  const raw = dataOf(json).expires_in ?? json.expires_in;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function readTransferStatus(json: Record<string, unknown>): string | null {
  const status = dataOf(json).status ?? json.status;
  return status == null ? null : String(status);
}

/** Only an explicit success settles; anything unrecognised stays pending. */
export function mapTransferStatus(status: string | null): "settled" | "failed" | "pending" {
  const value = (status ?? "").trim().toUpperCase();
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "COMPLETE", "SETTLED", "PAID"].includes(value)) return "settled";
  if (["FAILED", "FAILURE", "REJECTED", "DECLINED", "REVERSED", "CANCELLED"].includes(value)) return "failed";
  return "pending";
}
