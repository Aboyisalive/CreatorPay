import { describe, expect, it } from "vitest";
import {
  formatMoney,
  minorToNairaString,
  parseNairaToMinor,
  serialize,
} from "@/lib/money";

describe("money", () => {
  it("parses whole naira into kobo", () => {
    expect(parseNairaToMinor("1500")).toBe(BigInt(150_000));
  });

  it("parses decimals and commas safely", () => {
    expect(parseNairaToMinor("1,500.5")).toBe(BigInt(150_050));
    expect(parseNairaToMinor("0.01")).toBe(BigInt(1));
  });

  it("rejects invalid input", () => {
    expect(() => parseNairaToMinor("1,50.000")).toThrow();
    expect(() => parseNairaToMinor("abc")).toThrow();
  });

  it("round-trips minor units", () => {
    expect(minorToNairaString(BigInt(150_050))).toBe("1500.50");
    expect(minorToNairaString(BigInt(1))).toBe("0.01");
  });

  it("formats naira", () => {
    expect(formatMoney(BigInt(150_050))).toContain("1,500.50");
  });

  it("serializes bigint values as strings", () => {
    expect(serialize({ amount: BigInt(10) })).toEqual({ amount: "10" });
  });
});
