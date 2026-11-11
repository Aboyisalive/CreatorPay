import { describe, expect, it } from "vitest";
import { checkNuban, isValidNuban, nubanCheckDigit } from "./nuban";

// serial "0123456789" -> sum 219 -> check digit 1 (see nubanCheckDigit).
const VALID = "01234567891";

describe("checkNuban", () => {
  it("accepts a structurally valid NUBAN", () => {
    expect(checkNuban(VALID)).toEqual({ ok: true, reason: null });
    expect(isValidNuban(VALID)).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isValidNuban(`  ${VALID} `)).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(checkNuban("123").reason).toMatch(/11 digits/);
    expect(isValidNuban(`${VALID}0`)).toBe(false);
  });

  it("rejects non-digits", () => {
    expect(isValidNuban("0123456789A")).toBe(false);
    expect(isValidNuban("0123-567891")).toBe(false);
  });

  it("rejects a bad checksum", () => {
    // Flip the check digit.
    const bad = "01234567890";
    expect(isValidNuban(bad)).toBe(false);
    expect(checkNuban(bad).reason).toMatch(/checksum/);
  });
});

describe("nubanCheckDigit", () => {
  it("computes the check digit for a serial", () => {
    expect(nubanCheckDigit("0123456789")).toBe(1);
  });

  it("round-trips with validation", () => {
    const serial = "9988776655";
    const full = `${serial}${nubanCheckDigit(serial)}`;
    expect(isValidNuban(full)).toBe(true);
  });

  it("rejects a serial that is not 10 digits", () => {
    expect(() => nubanCheckDigit("123")).toThrow();
  });
});
