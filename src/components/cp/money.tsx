"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/cp/motion";

function toNumber(minor: string | number | null | undefined): number | null {
  if (minor === null || minor === undefined || minor === "") return null;
  const n = Number(minor);
  return Number.isFinite(n) ? n / 100 : null;
}

const SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", KES: "KSh ", GHS: "GH₵" };

export function formatAmount(amount: number, currency = "NGN", compact = false) {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const body = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
  }).format(amount);
  return `${amount < 0 ? "-" : ""}${symbol}${body.replace("-", "")}`;
}

/** Monospace ledger figure. Pass kobo (`minor`) strings straight from the API. */
export function Money({
  minor,
  currency = "NGN",
  className,
  animate = false,
  compact = false,
  estimate = false,
}: {
  minor: string | number | null | undefined;
  currency?: string;
  className?: string;
  animate?: boolean;
  compact?: boolean;
  /** Prefix with ≈ and italicise: value is not yet confirmed. */
  estimate?: boolean;
}) {
  const amount = toNumber(minor);
  const format = useCallback(
    (n: number) => formatAmount(n, currency, compact),
    [currency, compact],
  );

  if (amount === null) {
    return <span className={cn("num text-muted-foreground", className)}>—</span>;
  }

  return (
    <span className={cn("num whitespace-nowrap", estimate && "italic opacity-80", className)}>
      {estimate && "≈"}
      {animate ? <AnimatedNumber value={amount} format={format} /> : format(amount)}
    </span>
  );
}
