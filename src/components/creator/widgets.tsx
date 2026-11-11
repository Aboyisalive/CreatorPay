"use client";

import type { ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { motion } from "motion/react";
import { BadgeCheck, Hourglass, Info, Landmark, LockKeyhole, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreatorReward } from "@/lib/api-types";
import { CopyButton } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { Stagger, StaggerItem } from "@/components/cp/motion";
import { usePaidLabel } from "@/components/rail";
import { Button } from "@/components/ui/button";

export function useOrigin() {
  return useHydrated() ? window.location.origin : "";
}

export function TrackingLinkCard({
  path,
  hint,
  compact = false,
}: {
  path: string;
  hint?: ReactNode;
  compact?: boolean;
}) {
  const origin = useOrigin();
  const url = `${origin}${path}`;
  const display = url.replace(/^https?:\/\//, "");
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ url }).catch(() => null);
    } else {
      await navigator.clipboard.writeText(url).catch(() => null);
    }
  };
  return (
    <div className={cn("space-y-3", !compact && "rounded-xl border-2 border-brand-deep/20 bg-brand p-4 text-on-brand")}>
      {!compact && (
        <div className="flex items-center justify-between">
          <span className="eyebrow">Personal tracking link</span>
          <span className="eyebrow rounded-sm bg-on-brand/10 px-1.5 py-0.5">Active</span>
        </div>
      )}
      <div className={cn("num flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-[15px]", compact ? "bg-muted/60" : "border-on-brand/10 bg-[#fff8dc] text-on-brand")}>
        <span className="truncate">{display || path}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CopyButton value={url} label="Copy link" variant={compact ? "outline" : "ink"} size="lg" className={cn(!compact && "bg-on-brand text-white hover:bg-on-brand/85")} />
        <Button size="lg" variant={compact ? "default" : "outline"} onClick={share} className={cn(!compact && "border-on-brand/15 bg-white text-on-brand hover:bg-white/80 dark:bg-white dark:hover:bg-white/80")}>
          <Share2 /> Share
        </Button>
      </div>
      {hint && (
        <p className={cn("flex gap-2 border-t pt-3 text-sm", compact ? "text-muted-foreground" : "border-on-brand/15 text-on-brand/80")}>
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}

const LEVELS = [
  {
    key: "paid",
    label: "Paid",
    sub: "Bank-confirmed",
    statuses: ["PAID"],
    icon: BadgeCheck,
    className: "border-paid/25 bg-paid-tint text-paid",
  },
  {
    key: "payable",
    label: "Payable",
    sub: "Payout pending",
    statuses: ["PAYABLE", "PAYMENT_INITIATED"],
    icon: Landmark,
    className: "border-escrow/25 bg-escrow-tint text-escrow",
  },
  {
    key: "approved",
    label: "Approved",
    sub: "Signed off, not paid",
    statuses: ["APPROVED"],
    icon: LockKeyhole,
    className: "border-info/25 bg-info-tint text-info",
  },
  {
    key: "review",
    label: "Pending review",
    sub: "Calculated estimate",
    statuses: ["CALCULATED", "PENDING_REVIEW"],
    icon: Hourglass,
    className: "border-border bg-muted text-muted-foreground",
  },
];

export function sumMinor(rewards: CreatorReward[], statuses: string[]) {
  return rewards
    .filter((reward) => statuses.includes(reward.status))
    .reduce((sum, reward) => sum + BigInt(reward.totalMinor), BigInt(0))
    .toString();
}

/** Earnings split by truth level so approved money never reads as paid. */
export function EarningsLedger({ rewards }: { rewards: CreatorReward[] }) {
  const paidLabel = usePaidLabel();
  return (
    <Stagger className="space-y-2.5">
      {LEVELS.map((level, index) => {
        const total = sumMinor(rewards, level.statuses);
        const count = rewards.filter((r) => level.statuses.includes(r.status)).length;
        return (
          <StaggerItem key={level.key}>
            <motion.div whileTap={{ scale: 0.99 }} className={cn("flex items-center gap-3 rounded-lg border p-3.5", level.className)}>
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card/70">
                <level.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  {index + 1}. {level.label}
                </p>
                <p className="truncate text-sm text-foreground/75">
                  {count ? `${count} reward${count === 1 ? "" : "s"} · ` : ""}
                  {level.key === "paid" ? paidLabel : level.sub}
                </p>
              </div>
              <Money minor={total} animate estimate={level.key === "review" && total !== "0"} className="text-lg font-semibold" />
            </motion.div>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
