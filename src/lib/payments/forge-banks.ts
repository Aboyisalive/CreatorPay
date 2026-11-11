/**
 * Bank code mapping for the Forge (Xtradot Bank) sandbox.
 *
 * The app stores 3-digit CBN codes (src/lib/banks.ts). The sandbox speaks
 * 6-digit NIP codes (guide section 5.4). Access Bank (CBN 044) is stood in
 * for by Xtradot Bank (NIP 000014), which is the only intrabank case.
 * A code that is already 6 digits passes through unchanged.
 */

export const XTRADOT_NIP_CODE = "000014";

const CBN_TO_NIP: Record<string, string> = {
  "044": "000014", // Access Bank -> Xtradot Bank (sandbox)
  "058": "000013", // GTBank
  "057": "000015", // Zenith
  "011": "000016", // First Bank
  "033": "000004", // UBA
  "035": "000017", // Wema
};

export function toNipCode(bankCode: string | null): string | null {
  if (!bankCode) return null;
  if (/^\d{6}$/.test(bankCode)) return bankCode;
  return CBN_TO_NIP[bankCode] ?? null;
}
