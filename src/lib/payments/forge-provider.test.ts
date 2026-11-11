import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { toMinor } from "@/lib/money-server";
import { db } from "@/lib/db";
import { paymentsConfig, resetPaymentsConfig } from "./config";
import { ForgeProvider, mapStatus } from "./forge-provider";
import { toNipCode } from "./forge-banks";
import { verifySignature } from "./forge-webhook";

type Reply = { status: number; body: unknown };

function mockFetch(routes: Record<string, Reply | (() => Reply)>) {
  const calls: { key: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname.replace(/^\/v1/, "");
      const key = `${init.method} ${path}`;
      calls.push({ key, init });
      const hit = routes[key];
      if (!hit) throw new Error(`unmocked ${key}`);
      const r = typeof hit === "function" ? hit() : hit;
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
  return calls;
}

const ok = (data: unknown, status = 200): Reply => ({ status, body: { status: "success", data } });
const err = (status: number, code: string): Reply => ({
  status,
  body: { status: "error", error: { code, message: code } },
});

let provider: ForgeProvider;

beforeEach(() => {
  process.env.GATEWAY_KEY = "team-key";
  process.env.FORGE_SOURCE_ACCOUNT = "0123456793";
  process.env.FORGE_BANK_BASE_URL = "http://bank.test/v1";
  resetPaymentsConfig();
  vi.spyOn(db.providerCall, "create").mockResolvedValue({} as never);
  provider = new ForgeProvider(paymentsConfig());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const input = {
  accountNo: "0123987001",
  bankCode: "058",
  amountMinor: toMinor(7_500_000), // N75,000.00
  currency: "NGN",
  narration: "Generator repairs",
  requestId: "po_abc",
};

describe("ForgeProvider.payout", () => {
  it("does name enquiry then interbank transfer with Idempotency-Key", async () => {
    const calls = mockFetch({
      "GET /transfers/po_abc": err(404, "NOT_FOUND"),
      "POST /transfers/interbank/name-enquiry": ok({ name_enquiry_ref: "ne_1", account_name: "Chukwuemeka" }),
      "POST /transfers/interbank": ok({ status: "pending" }, 202),
    });
    const result = await provider.payout(input);
    expect(result).toMatchObject({ state: "pending", bankReference: "po_abc" });
    const transfer = calls.find((c) => c.key === "POST /transfers/interbank")!;
    expect((transfer.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("po_abc");
    expect((transfer.init.headers as Record<string, string>)["x-api-key"]).toBe("team-key");
    expect(JSON.parse(transfer.init.body as string)).toMatchObject({
      source_account: "0123456793",
      destination_bank_code: "000013",
      name_enquiry_ref: "ne_1",
      amount: 75000,
      reference: "po_abc",
    });
  });

  it("uses intra endpoints for Access/Xtradot (044)", async () => {
    const calls = mockFetch({
      "GET /transfers/po_abc": err(404, "NOT_FOUND"),
      "POST /transfers/intra/name-enquiry": ok({ name_enquiry_ref: "ne_2" }),
      "POST /transfers/intra": ok({ status: "successful" }, 201),
    });
    const result = await provider.payout({ ...input, bankCode: "044", accountNo: "0987654321" });
    expect(calls.map((c) => c.key)).toContain("POST /transfers/intra");
    // Ack is not settlement even when the bank says successful.
    expect(result.state).toBe("pending");
  });

  it("resumes an existing transfer instead of resending", async () => {
    const calls = mockFetch({ "GET /transfers/po_abc": ok({ status: "successful" }) });
    const result = await provider.payout(input);
    expect(result.state).toBe("settled");
    expect(calls).toHaveLength(1);
  });

  it("never resends on 504: returns unknown with a reference to poll", async () => {
    const calls = mockFetch({
      "GET /transfers/po_abc": err(404, "NOT_FOUND"),
      "POST /transfers/interbank/name-enquiry": ok({ name_enquiry_ref: "ne_1" }),
      "POST /transfers/interbank": err(504, "TIMEOUT"),
    });
    const result = await provider.payout(input);
    expect(result).toMatchObject({ state: "unknown", bankReference: "po_abc", rawCode: "TIMEOUT" });
    expect(calls.filter((c) => c.key === "POST /transfers/interbank")).toHaveLength(1);
  });

  it("fails cleanly on insufficient funds and bank-down enquiry", async () => {
    mockFetch({
      "GET /transfers/po_abc": err(404, "NOT_FOUND"),
      "POST /transfers/interbank/name-enquiry": ok({ name_enquiry_ref: "ne_1" }),
      "POST /transfers/interbank": err(402, "INSUFFICIENT_FUNDS"),
    });
    expect(await provider.payout(input)).toMatchObject({ state: "failed", rawCode: "INSUFFICIENT_FUNDS" });

    mockFetch({
      "GET /transfers/po_abc": err(404, "NOT_FOUND"),
      "POST /transfers/interbank/name-enquiry": err(503, "BANK_UNAVAILABLE"),
    });
    expect(await provider.payout(input)).toMatchObject({ state: "failed", rawCode: "BANK_UNAVAILABLE" });
  });

  it("fails an unsupported bank without calling the network", async () => {
    const calls = mockFetch({});
    expect(await provider.payout({ ...input, bankCode: "999" })).toMatchObject({ state: "failed" });
    expect(calls).toHaveLength(0);
  });
});

describe("ForgeProvider.payoutStatus / verifyAccount", () => {
  it("maps statuses; reversed counts as failed, unknown stays pending", async () => {
    expect(mapStatus("successful")).toBe("settled");
    expect(mapStatus("reversed")).toBe("failed");
    expect(mapStatus("pending")).toBe("pending");
    expect(mapStatus(null)).toBe("pending");
  });

  it("polls by reference and treats a missing transfer as unknown", async () => {
    mockFetch({ "GET /transfers/po_x": err(404, "NOT_FOUND") });
    expect((await provider.payoutStatus("po_x")).state).toBe("unknown");
  });

  it("verifies via name enquiry and surfaces the name", async () => {
    mockFetch({
      "POST /transfers/interbank/name-enquiry": ok({ name_enquiry_ref: "ne_1", account_name: "Funmilayo Ogunleye" }),
    });
    expect(await provider.verifyAccount("0123987002", "057")).toEqual({
      status: "verified",
      accountName: "Funmilayo Ogunleye",
      reason: null,
    });
  });

  it("marks missing accounts invalid", async () => {
    mockFetch({ "POST /transfers/interbank/name-enquiry": err(404, "ACCOUNT_NOT_FOUND") });
    expect((await provider.verifyAccount("0000000001", "058")).status).toBe("invalid");
  });
});

describe("helpers", () => {
  it("maps CBN to NIP codes and passes 6-digit codes through", () => {
    expect(toNipCode("044")).toBe("000014");
    expect(toNipCode("058")).toBe("000013");
    expect(toNipCode("090405")).toBe("090405");
    expect(toNipCode("999")).toBeNull();
  });

  it("verifies webhook signatures and rejects stale or forged ones", () => {
    const secret = "whsec_test";
    const body = '{"event_id":"evt_1"}';
    const now = 1_800_000_000;
    const sig = `sha256=${createHmac("sha256", secret).update(`${now}.${body}`).digest("hex")}`;
    expect(verifySignature(body, String(now), sig, secret, now)).toBe(true);
    expect(verifySignature(body, String(now), sig, "other", now)).toBe(false);
    expect(verifySignature(body + " ", String(now), sig, secret, now)).toBe(false);
    expect(verifySignature(body, String(now), sig, secret, now + 301)).toBe(false);
  });
});
