export const DEFAULT_CURRENCY = "NGN";

/**
 * Convert a naira amount (e.g. "1,500.50") to integer kobo without using
 * floating point arithmetic.
 */
export function parseNairaToMinor(value: string | number | bigint): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  const raw = String(value).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Invalid money amount: ${value}`);
  }

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = unsigned.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));

  return negative ? -minor : minor;
}

export function minorToNairaString(minor: bigint): string {
  const negative = minor < BigInt(0);
  const unsigned = negative ? -minor : minor;
  const whole = unsigned / BigInt(100);
  const fraction = (unsigned % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function formatMoney(minor: bigint, currency = DEFAULT_CURRENCY): string {
  const amount = Number(minor) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyCompact(minor: bigint, currency = DEFAULT_CURRENCY): string {
  const amount = Number(minor) / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/**
 * Convert values into JSON-safe primitives so route handler responses are JSON
 * safe. BigInt has no native JSON representation, so it is stringified here.
 *
 * Prisma Decimal values need no special handling: JSON.stringify applies a
 * value's own `toJSON()` before this replacer, and Decimal's `toJSON()` already
 * returns the exact integer-kobo string.
 */
export function serialize<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) =>
      typeof inner === "bigint" ? inner.toString() : inner,
    ),
  );
}
