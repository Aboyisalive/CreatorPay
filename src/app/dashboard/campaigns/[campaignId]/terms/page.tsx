"use client";

import { motion } from "motion/react";
import { FileClock, Lock, PenLine } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { TermVersion } from "@/lib/api-types";
import { useCampaignId } from "@/components/campaign/use-campaign";
import { EmptyState, ErrorState, LoadingRows, Panel } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";

export default function TermsTab() {
  const id = useCampaignId();
  const { data, error, mutate } = useApiData<{ versions: TermVersion[] }>(`/api/v1/campaigns/${id}/terms/versions`);

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!data) return <LoadingRows />;
  if (!data.versions.length) return <EmptyState icon={<FileClock />} title="No terms yet" />;

  return (
    <Panel title="Terms version history" description="Every version creators can accept is preserved. Published versions are locked.">
      <ol className="relative space-y-0 p-5">
        {data.versions.map((version, index) => {
          const snapshot = version.snapshot as { attribution?: { note?: string }; policies?: Record<string, string> };
          return (
            <motion.li
              key={version.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 } }}
              className="relative flex gap-4 pb-8 last:pb-0"
            >
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "num z-10 grid size-10 place-items-center rounded-md border font-semibold",
                    version.isCurrent ? "border-brand bg-brand text-on-brand" : "bg-card",
                  )}
                >
                  v{version.version}
                </span>
                {index < data.versions.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1 space-y-3 rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {version.publishedAt ? (
                    <StatusBadge truth="paid" label="Locked" />
                  ) : (
                    <StatusBadge truth="neutral" label="Draft" />
                  )}
                  {version.isCurrent && <StatusBadge truth="live" label="Current" />}
                  <Tag>{version.acceptedCount} accepted</Tag>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <PenLine className="size-3.5" /> {version.createdBy?.name ?? "System"} · {formatStamp(version.createdAt)}
                  </span>
                  {version.publishedAt && (
                    <span className="inline-flex items-center gap-1">
                      <Lock className="size-3.5" /> Published {formatStamp(version.publishedAt)}
                    </span>
                  )}
                </p>
                <ul className="divide-y rounded-md border">
                  {version.rewardRules.map((rule) => (
                    <li key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span>
                        {rule.name}
                        {rule.maxCount ? <span className="text-muted-foreground"> · max {rule.maxCount}</span> : null}
                      </span>
                      <Money minor={rule.amountMinor} className="font-medium" />
                    </li>
                  ))}
                </ul>
                {snapshot.attribution?.note && <p className="text-sm text-muted-foreground">{snapshot.attribution.note}</p>}
                {snapshot.policies && (
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {Object.entries(snapshot.policies).map(([key, value]) => (
                      <div key={key} className="rounded-md bg-muted/40 p-2.5">
                        <dt className="eyebrow text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</dt>
                        <dd className="mt-0.5">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Panel>
  );
}
