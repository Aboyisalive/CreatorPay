"use client";

import { FlaskConical, Landmark } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Rail = { provider: "ecobank" | "mock"; environment: "sandbox" | "production"; simulated: boolean };

export function useRail() {
  const { data } = useApiData<{ rail: Rail }>("/api/v1/payments/rail", { revalidateOnFocus: false });
  return data?.rail ?? null;
}

/** Labels which rail moves money: live Ecobank, Ecobank UAT, or a simulation. */
export function RailBadge({ className }: { className?: string }) {
  const rail = useRail();
  if (!rail) return null;
  const label = rail.simulated
    ? "Simulated bank rail"
    : rail.environment === "production"
      ? "Ecobank · Live"
      : "Ecobank · UAT sandbox";
  const hint = rail.simulated
    ? "Payouts and deposits run through a simulator with the same states as Ecobank. No real money moves."
    : rail.environment === "production"
      ? "Payouts are sent to Ecobank and confirmed by status query."
      : "Payouts are sent to Ecobank's UAT test gateway. No real money moves.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "eyebrow inline-flex h-6 cursor-help items-center gap-1.5 rounded-sm border px-2 text-[10px]",
            rail.simulated || rail.environment !== "production"
              ? "border-info/25 bg-info-tint text-info"
              : "border-paid/25 bg-paid-tint text-paid",
            className,
          )}
        >
          {rail.simulated ? <FlaskConical className="size-3" /> : <Landmark className="size-3" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

/** "Bank-confirmed" vs "Simulator-confirmed" for paid amounts. */
export function usePaidLabel() {
  const rail = useRail();
  return rail?.simulated ? "Simulator-confirmed" : "Bank-confirmed";
}
