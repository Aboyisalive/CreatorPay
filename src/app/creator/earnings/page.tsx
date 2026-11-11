"use client";

import { motion } from "motion/react";
import { Check, Loader2, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { CreatorReward, RewardDetail } from "@/lib/api-types";
import { CreatorHeader } from "@/components/creator-shell";
import { RailBadge } from "@/components/rail";
import { EarningsLedger, sumMinor } from "@/components/creator/widgets";
import { EmptyState, ErrorState } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { FadeIn, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = [
  { label: "Calculated", statuses: ["CALCULATED", "PENDING_REVIEW"] },
  { label: "Approved", statuses: ["APPROVED"] },
  { label: "Payable", statuses: ["PAYABLE", "PAYMENT_INITIATED", "PAYMENT_FAILED"] },
  { label: "Paid", statuses: ["PAID"] },
];

const ACCENT: Record<string, string> = {
  PAID: "border-l-paid",
  PAYABLE: "border-l-escrow",
  PAYMENT_INITIATED: "border-l-info",
  APPROVED: "border-l-info",
  DISPUTED: "border-l-breach",
  PAYMENT_FAILED: "border-l-breach",
};

export default function EarningsPage() {
  const { data, error, mutate } = useApiData<{ rewards: CreatorReward[] }>("/api/v1/creators/me/rewards");
  const rewards = data?.rewards ?? [];
  const confirmed = sumMinor(rewards, ["APPROVED", "PAYABLE", "PAYMENT_INITIATED", "PAID"]);

  return (
    <>
      <CreatorHeader back="/creator" title="Earnings & rewards" subtitle="Every naira, with its formula" />
      <div className="space-y-5 p-4">
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : !data ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <FadeIn className="rounded-xl border bg-card p-5">
              <p className="eyebrow text-muted-foreground">Approved earnings to date</p>
              <div className="mt-1 flex items-baseline gap-2">
                <Money minor={confirmed} animate className="text-4xl font-semibold tracking-tight" />
                <Tag>NGN</Tag>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Excludes amounts still being reviewed. See the split below.</p>
              <RailBadge className="mt-3" />
              <div className="mt-4">
                <EarningsLedger rewards={rewards} />
              </div>
            </FadeIn>

            <h2 className="pt-1 text-xl font-semibold">Itemised formulas</h2>
            {rewards.length === 0 ? (
              <div className="rounded-xl border bg-card">
                <EmptyState icon={<Wallet />} title="No rewards yet" description="Rewards appear once a business calculates them from your verified, eligible events." />
              </div>
            ) : (
              <Stagger className="space-y-4">
                {rewards.map((reward) => (
                  <StaggerItem key={reward.id}>
                    <RewardCard reward={reward} />
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </>
        )}
      </div>
    </>
  );
}

function RewardCard({ reward }: { reward: CreatorReward }) {
  const detail = useApiData<{ reward: RewardDetail }>(`/api/v1/rewards/${reward.id}`);
  const stepIndex = STEPS.findIndex((step) => step.statuses.includes(reward.status));
  const disputed = reward.status === "DISPUTED";
  const grouped = new Map<string, { description: string; qty: number; unit: string; amount: bigint }>();
  for (const line of reward.lines) {
    const key = `${line.description}|${line.unitAmountMinor}`;
    const entry = grouped.get(key) ?? { description: line.description, qty: 0, unit: line.unitAmountMinor, amount: BigInt(0) };
    entry.qty += line.quantity;
    entry.amount += BigInt(line.amountMinor);
    grouped.set(key, entry);
  }
  const settlements = detail.data?.reward.settlements ?? [];

  return (
    <article className={cn("space-y-4 rounded-xl border border-l-4 bg-card p-4", ACCENT[reward.status] ?? "border-l-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{reward.campaign.name}</p>
          <p className="num text-xs text-muted-foreground">
            calc v{reward.version} · {formatStamp(reward.calculatedAt)}
          </p>
        </div>
        <StatusBadge status={reward.status} />
      </div>

      {disputed ? (
        <div className="flex gap-2 rounded-lg border border-breach/25 bg-breach-tint p-3 text-sm text-breach">
          <ShieldAlert className="size-4 shrink-0" />
          <p>This reward is under dispute{detail.data?.reward.disputeReason ? `: ${detail.data.reward.disputeReason}` : "."} Settlement is paused.</p>
        </div>
      ) : (
        <ol className="flex items-start" aria-label="Settlement lifecycle">
          {STEPS.map((step, index) => {
            const complete = index < stepIndex || reward.status === "PAID";
            const current = index === stepIndex && reward.status !== "PAID";
            return (
              <li key={step.label} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                {index > 0 && (
                  <span className="absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 bg-border">
                    <motion.span
                      className="block h-full bg-brand"
                      initial={{ width: 0 }}
                      animate={{ width: index <= stepIndex || reward.status === "PAID" ? "100%" : 0 }}
                      transition={{ delay: index * 0.15, duration: 0.4 }}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "relative z-10 grid size-8 place-items-center rounded-full border-2 bg-card",
                    complete && "border-paid bg-paid text-white dark:text-[#06210f]",
                    current && "border-brand bg-brand text-on-brand",
                  )}
                >
                  {complete ? <Check className="size-4" /> : current ? <Loader2 className="size-4 animate-spin [animation-duration:2.5s]" /> : <span className="size-1.5 rounded-full bg-border" />}
                </span>
                <span className={cn("text-[11px] font-medium", !complete && !current && "text-muted-foreground")}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="space-y-2 rounded-lg bg-muted/40 p-3">
        {grouped.size === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible events counted in this calculation.</p>
        ) : (
          [...grouped.values()].map((line) => (
            <div key={line.description + line.unit} className="num flex flex-wrap items-center justify-between gap-1 text-sm">
              <span>
                {line.qty} × <Money minor={line.unit} /> <span className="font-sans text-xs text-muted-foreground">({line.description})</span>
              </span>
              <span className="font-semibold">
                = <Money minor={line.amount.toString()} />
              </span>
            </div>
          ))
        )}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">Total</span>
          <Money minor={reward.totalMinor} className="text-lg font-semibold" />
        </div>
      </div>

      {settlements.length > 0 && (
        <ul className="space-y-1.5">
          {settlements.map((settlement) => (
            <li key={settlement.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="size-3.5" />
              <span className="flex-1">
                {settlement.method} · <span className="num">{settlement.reference}</span> · {formatStamp(settlement.createdAt)}
              </span>
              <StatusBadge truth="info" label="Recorded by business" dot={false} className="h-5 text-[9px]" />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
