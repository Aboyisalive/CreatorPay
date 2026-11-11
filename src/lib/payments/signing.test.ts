import { describe, expect, it } from "vitest";
import { toMinor } from "@/lib/money-server";
import {
  domesticTransferTail,
  formatAmountMinor,
  headerBase,
  sha512Hex,
  signRequest,
  transferAmount,
  type SigningHeader,
} from "./signing";

const HEADER: SigningHeader = {
  clientId: "client123",
  affiliateCode: "EGH",
  sourceCode: "SRC1",
  requestId: "req-001",
  requestType: "PAYMENT",
  ipAddress: "196.46.20.10",
};
const SECRET = "supersecret";

const TAIL = domesticTransferTail({
  receiverAccountNo: "01234567890",
  amount: "50000.00",
  currency: "NGN",
  description: "Creator payout",
});

// Independent vectors (node crypto), so a refactor cannot just re-derive them.
const EXPECTED_BASE = "client123EGHSRC1req-001PAYMENT196.46.20.10";
const EXPECTED_REQUEST_TOKEN =
  "4763e2d44a912a0206b069bdb87807e9e94cedbdf7e6ab6a36f503cecdf46a8b1904204ee0085f736cd98fcdeec2a5affe92b58f5ef52239089a2b5e3ac67277";
const EXPECTED_SECURE_HASH =
  "f38fe50d3d7d52b563d55bc6899e578cca5e00238ce13112e8b697f06e5ce1556dceb98edbe0943060c85ecc3459b0b86da1c32d73dbf5a27193e02be2f5200a";

describe("sha512Hex", () => {
  it("returns lowercase 128-char hex", () => {
    const out = sha512Hex("abc");
    expect(out).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe("headerBase", () => {
  it("concatenates in hash order (clientId first), not JSON/body order", () => {
    expect(headerBase(HEADER)).toBe(EXPECTED_BASE);
  });
});

describe("signRequest", () => {
  it("matches the independent requestToken and secureHash vectors", () => {
    const { requestToken, secureHash } = signRequest(HEADER, SECRET, TAIL);
    expect(requestToken).toBe(EXPECTED_REQUEST_TOKEN);
    expect(secureHash).toBe(EXPECTED_SECURE_HASH);
  });

  it("does NOT match when the base is built in body (document) order", () => {
    // The trap: the JSON payload starts affiliateCode, clientId. If someone
    // derives the hash from that order, the digest must differ from ours.
    const wrongBase =
      HEADER.affiliateCode + HEADER.clientId + HEADER.sourceCode + HEADER.requestId + HEADER.requestType + HEADER.ipAddress;
    expect(wrongBase).not.toBe(EXPECTED_BASE);
    const wrong = signRequest({ ...HEADER }, SECRET, TAIL);
    // Recompute what a body-order implementation would produce.
    const bodyOrderHash = sha512Hex(
      wrongBase + sha512Hex(wrongBase + SECRET) + TAIL.join("") + SECRET,
    );
    expect(wrong.secureHash).not.toBe(bodyOrderHash);
  });

  it("is sensitive to the requestId (a stale hash cannot be reused)", () => {
    const fresh = signRequest(HEADER, SECRET, TAIL);
    const stale = signRequest({ ...HEADER, requestId: "req-002" }, SECRET, TAIL);
    expect(stale.secureHash).not.toBe(fresh.secureHash);
    expect(stale.requestToken).not.toBe(fresh.requestToken);
  });

  it("is sensitive to the secret", () => {
    const a = signRequest(HEADER, SECRET, TAIL);
    const b = signRequest(HEADER, "other-secret", TAIL);
    expect(b.secureHash).not.toBe(a.secureHash);
  });
});

describe("formatAmountMinor", () => {
  it("renders kobo as exact naira with two decimals", () => {
    expect(formatAmountMinor(toMinor(5_000_000))).toBe("50000.00");
    expect(formatAmountMinor(toMinor(1))).toBe("0.01");
    expect(formatAmountMinor(toMinor(100))).toBe("1.00");
    expect(formatAmountMinor(toMinor(0))).toBe("0.00");
    expect(formatAmountMinor(toMinor(123_456_789))).toBe("1234567.89");
  });

  it("produces the exact text used in both the body and the hash", () => {
    // One formatter feeds the JSON body's amountString AND the hash tail, so
    // they can never disagree (trap 3).
    const amountString = formatAmountMinor(toMinor(5_000_000));
    const tail = domesticTransferTail({
      receiverAccountNo: "01234567890",
      amount: amountString,
      currency: "NGN",
      description: "Creator payout",
    });
    const { secureHash } = signRequest(HEADER, SECRET, tail);
    expect(amountString).toBe("50000.00");
    expect(secureHash).toBe(EXPECTED_SECURE_HASH);
  });
});

describe("transferAmount", () => {
  it("renders the amount exactly as the JSON body encodes it", () => {
    expect(transferAmount(toMinor(5_000_000))).toEqual({ value: 50000, text: "50000" });
    expect(transferAmount(toMinor(150_050))).toEqual({ value: 1500.5, text: "1500.5" });
    expect(transferAmount(toMinor(123_456_789))).toEqual({ value: 1234567.89, text: "1234567.89" });
    const body = JSON.stringify({ amount: transferAmount(toMinor(150_050)).value });
    expect(body).toBe(`{"amount":${transferAmount(toMinor(150_050)).text}}`);
  });
});
