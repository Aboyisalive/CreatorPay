/**
 * NUBAN (Nigeria Unified Bank Account Number) validation.
 *
 * A NUBAN is exactly 11 digits. The final digit is a modulus-10 check digit
 * computed over the first 10 with alternating weights 3,7,3,3,7,3,3,7,3,7
 * (NIBSS standard). This validates the number's SHAPE and checksum only -- it
 * is never proof that the account exists or that the name matches. Real name
 * verification needs Account Enquiry, which we cannot subscribe to yet, so a
 * passing NUBAN check yields `format_ok_unverified`, not `verified`.
 */

const WEIGHTS = [3, 7, 3, 3, 7, 3, 3, 7, 3, 7] as const;

export type NubanCheck = { ok: boolean; reason: string | null };

/** True when the account number is a structurally valid NUBAN. */
export function isValidNuban(accountNo: string): boolean {
  return checkNuban(accountNo).ok;
}

/** Validate a NUBAN, returning a human-readable reason on failure. */
export function checkNuban(accountNo: string): NubanCheck {
  const digits = accountNo.trim();

  if (digits.length !== 11) {
    return { ok: false, reason: "Account number must be exactly 11 digits." };
  }
  if (!/^\d{11}$/.test(digits)) {
    return { ok: false, reason: "Account number must contain only digits." };
  }

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * WEIGHTS[i];
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  if (checkDigit !== Number(digits[10])) {
    return { ok: false, reason: "Account number failed its checksum." };
  }

  return { ok: true, reason: null };
}

/**
 * Compute the NUBAN check digit for a 10-digit serial. Useful for generating
 * valid test account numbers; not used on the payout path.
 */
export function nubanCheckDigit(serial10: string): number {
  if (!/^\d{10}$/.test(serial10)) {
    throw new Error("Serial must be exactly 10 digits.");
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(serial10[i]) * WEIGHTS[i];
  }
  return (10 - (sum % 10)) % 10;
}
