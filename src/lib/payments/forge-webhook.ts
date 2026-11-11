import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

/** Guide s5.6: sha256=<hex HMAC-SHA256 of "{timestamp}.{raw_body}">, skew <= 5 min. */
export function verifySignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
