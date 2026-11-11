import { createHash } from "node:crypto";
import type { Minor } from "@/lib/money-server";

/**
 * Ecobank request signing (community reference, Local Bank Payment -- see the
 * integration plan section 11). Verified against the real API definition before
 * any live call.
 *
 * The scheme is plain SHA-512 over UTF-8, lowercase hex (128 chars). It is NOT
 * HMAC: the secret is simply appended. Three traps are handled here so they can
 * never bite the call sites:
 *
 *   1. `requestToken` feeds into `secureHash` -- compute it first, then reuse.
 *   2. Hash field order is NOT JSON order. The payload starts `affiliateCode,
 *      clientId`; the hash starts `clientId, affiliateCode`. This module owns
 *      the hash order so nobody re-derives it from the body.
 *   3. The amount is hashed as text and must match the body's rendering
 *      exactly. `formatAmountMinor` is the ONE canonical formatter used by both
 *      the JSON body and the hash, so the two can never disagree.
 */

/** Fields shared by every call's hash base, in hash order (clientId first). */
export type SigningHeader = {
  clientId: string;
  affiliateCode: string;
  sourceCode: string;
  requestId: string;
  requestType: string;
  ipAddress: string;
};

/** SHA-512 over UTF-8, lowercase hex. */
export function sha512Hex(value: string): string {
  return createHash("sha512").update(value, "utf8").digest("hex");
}

/** The concatenation shared by `requestToken` and `secureHash`. */
export function headerBase(header: SigningHeader): string {
  return (
    header.clientId +
    header.affiliateCode +
    header.sourceCode +
    header.requestId +
    header.requestType +
    header.ipAddress
  );
}

/** Derive `requestToken` and `secureHash` for a call. */
export function signRequest(
  header: SigningHeader,
  secretKey: string,
  tail: readonly string[],
): { requestToken: string; secureHash: string } {
  const base = headerBase(header);
  // Trap 1: requestToken is computed first, then folded into secureHash.
  const requestToken = sha512Hex(base + secretKey);
  const secureHash = sha512Hex(base + requestToken + tail.join("") + secretKey);
  return { requestToken, secureHash };
}

/**
 * Canonical amount formatter -- the single source for both the request body
 * and the `secureHash` (trap 3).
 *
 * Takes integer minor units (kobo) as a `Minor` (Prisma Decimal) and renders
 * exact naira with two decimals, using string manipulation only (no division,
 * no floats). 5,000,000 kobo -> "50000.00".
 *
 * TODO(integration): the exact text rendering the sandbox expects ("50000.00"
 * vs "50000" vs "50000.0") is unconfirmed. Confirm against the API definition,
 * then change ONLY this function -- the body and hash stay in lockstep because
 * they both call it.
 */
export function formatAmountMinor(minorUnits: Minor): string {
  const negative = minorUnits.isNegative();
  // Kobo is stored as an integer, so toFixed(0) is an exact integer string.
  const digits = minorUnits.abs().toFixed(0);
  const padded = digits.padStart(3, "0"); // ensure "0.XX" for sub-naira amounts
  const naira = padded.slice(0, -2);
  const kobo = padded.slice(-2);
  return `${negative ? "-" : ""}${naira}.${kobo}`;
}

/**
 * The transfer body's `amount` is a JSON number, and the bank hashes it as the
 * text the JSON encoder writes ("1500", "1500.5" -- not "1500.00"). Deriving
 * both from one value keeps body and hash identical (trap 3).
 */
export function transferAmount(minorUnits: Minor): { value: number; text: string } {
  const value = Number(formatAmountMinor(minorUnits));
  return { value, text: JSON.stringify(value) };
}

// --- Endpoint-specific hash tails (fields appended after requestToken). ------

export function tokenTail(input: { publicKey: string; serviceCode: string }): string[] {
  return [input.publicKey, input.serviceCode];
}

export function domesticTransferTail(input: {
  receiverAccountNo: string;
  /** Must be `transferAmount(...).text` so body and hash agree. */
  amount: string;
  currency: string;
  description: string;
}): string[] {
  return [input.receiverAccountNo, input.amount, input.currency, input.description];
}

export function statusTail(transactionReference: string): string[] {
  return [transactionReference];
}
