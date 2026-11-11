/** Common Nigerian banks with their 3-digit CBN codes (payout destinations). */
export const NIGERIAN_BANKS: { code: string; name: string }[] = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "103", name: "Globus Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "102", name: "Titan Trust Bank" },
  { code: "032", name: "Union Bank" },
  { code: "033", name: "United Bank for Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  // Forge sandbox fintechs (6-digit NIP codes, passed through as-is).
  { code: "090405", name: "Moniepoint" },
  { code: "100004", name: "OPay" },
];

export function bankName(code: string | null | undefined): string {
  return NIGERIAN_BANKS.find((bank) => bank.code === code)?.name ?? code ?? "—";
}
