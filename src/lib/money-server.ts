import { Prisma } from "@/generated/prisma/client";
import { parseNairaToMinor } from "@/lib/money";

/**
 * Server-side money helpers.
 *
 * Money is stored as NUMERIC(18, 0) columns holding integer minor units
 * (kobo). Arithmetic goes through Prisma's Decimal, never binary floats, so a
 * reward total can never pick up a rounding error. The API contract is
 * unchanged: values still serialize as integer-kobo strings.
 *
 * This module imports the generated Prisma client, so it must only ever be
 * imported from server code. The client-safe money module is `@/lib/money`.
 */

export type Minor = Prisma.Decimal;

/** Exact zero in minor units. Decimal is immutable, so sharing is safe. */
export const ZERO_MINOR: Minor = new Prisma.Decimal(0);

/** Convert integer kobo (already exactly parsed) into a Decimal. */
export function toMinor(value: bigint | number | string): Minor {
  return new Prisma.Decimal(value.toString());
}

/**
 * Parse a naira amount (for example "1500.50") into exact minor units.
 * The validation and string math live in the client-safe module; this only
 * wraps the exact result in a Decimal for storage and arithmetic.
 */
export function parseNairaToMinorDecimal(value: string | number | bigint): Minor {
  return toMinor(parseNairaToMinor(value));
}
