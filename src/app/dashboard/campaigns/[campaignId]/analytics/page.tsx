"use client";

import { motion } from "motion/react";
import { Bot, Download, MousePointerClick } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import { labelOf, truthOf, TRUTH_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useCampaignId } from "@/components/campaign/use-campaign";
import { EmptyState, ErrorState, LoadingRows, Panel } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Analytics = {
  clicks: { total: number; eligible: number };
  events: { total: number; byVerification: Record<string, number>; byEligibility: Record<string, number> };
  participants: Record<string, number>;
  submissions: Record<string, number>;
  rewards: { byStatus: Record<string, number>; totalMinorByStatus: Record<string, string> };
};

type Clicks = {
  total: number;
  eligible: number;
  recentClicks: { id: string; occurredAt: string; isBot: boolean; isEligible: boolean; invalidReason: string | null; creatorName: string; linkToken: string }[];
  byDate: { date: string; total: number; eligible: number }[];
};

export default function AnalyticsTab() {
  const id = useCampaignId();
  const analytics = useApiData<Analytics>(`/api/v1/campaigns/${id}/analytics`);
  const clicks = useApiData<Clicks>(`/api/v1/campaigns/${id}/clicks`);

  if (analytics.error) return <ErrorState message={analytics.error.message} onRetry={() => analytics.mutate()} />;
  if (!analytics.data) return <LoadingRows rows={5} />;
  const a = analytics.data;
  const series = clicks.data?.byDate ?? [];
  const max = Math.max(1, ...series.map((d) => d.total));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={`/api/v1/campaigns/${id}/report.csv`}>
            <Download /> Campaign report CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Click activity" description="Raw vs eligible, from the most recent 50 clicks (WAT)">
          <div className="p-5">
            {series.length === 0 ? (
              <EmptyState icon={<MousePointerClick />} title="No clicks recorded yet" />
            ) : (
              <>
                <div className="flex h-52 items-end gap-1.5" role="img" aria-label="Daily clicks chart">
                  {series.map((day, index) => (
                    <Tooltip key={day.date}>
                      <TooltipTrigger asChild>
                        <div className="group flex h-full flex-1 flex-col justify-end">
                          <motion.div
                            className="relative w-full overflow-hidden rounded-t-sm bg-muted"
                            initial={{ height: 0 }}
                            animate={{ height: `${(day.total / max) * 100}%` }}
                            transition={{ delay: index * 0.03, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="absolute inset-x-0 bottom-0 bg-brand transition-colors group-hover:bg-brand-deep" style={{ height: `${(day.eligible / Math.max(1, day.total)) * 100}%` }} />
                          </motion.div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="num">
                          {day.date}: {day.eligible} eligible / {day.total} raw
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <div className="num mt-2 flex justify-between text-[11px] text-muted-foreground">
                  <span>{series[0]!.date}</span>
                  <span>{series[series.length - 1]!.date}</span>
                </div>
                <div className="mt-4 flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" /> Eligible</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted" /> Invalid / bot</span>
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Funnel" description="Clicks to rewarded outcomes">
          <div className="space-y-3 p-5">
            {[
              { label: "Raw clicks", value: a.clicks.total },
              { label: "Eligible clicks", value: a.clicks.eligible },
              { label: "Events received", value: a.events.total },
              { label: "Verified events", value: a.events.byVerification.VERIFIED ?? 0 },
              { label: "Eligible events", value: a.events.byEligibility.ELIGIBLE ?? 0 },
            ].map((step, index, list) => {
              const width = list[0]!.value ? Math.max(4, (step.value / list[0]!.value) * 100) : 4;
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="num font-medium">{step.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-brand"
                      style={{ opacity: 1 - index * 0.13 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ delay: index * 0.08, duration: 0.7 }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-xs text-muted-foreground">ROI isn&apos;t shown: it needs revenue and cost data this campaign doesn&apos;t record.</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Breakdown title="Participants" data={a.participants} />
        <Breakdown title="Submissions" data={a.submissions} />
        <Panel title="Rewards by status">
          <ul className="divide-y">
            {Object.keys(a.rewards.byStatus).length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">No rewards yet</li>}
            {Object.entries(a.rewards.byStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-2 px-5 py-3">
                <StatusBadge status={status} />
                <span className="text-right">
                  <Money minor={a.rewards.totalMinorByStatus[status]} className="block text-sm font-semibold" />
                  <span className="num text-xs text-muted-foreground">{count} creator{count === 1 ? "" : "s"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Click log" description="Latest clicks with eligibility decisions">
        {!clicks.data ? (
          <LoadingRows rows={3} />
        ) : clicks.data.recentClicks.length === 0 ? (
          <EmptyState icon={<MousePointerClick />} title="No clicks yet" />
        ) : (
          <ul className="max-h-[420px] divide-y overflow-y-auto">
            {clicks.data.recentClicks.map((click) => (
              <li key={click.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="num w-44 shrink-0 text-xs text-muted-foreground">{formatStamp(click.occurredAt)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{click.creatorName}</span>
                {click.isBot && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Bot className="size-3.5" /> Bot
                  </span>
                )}
                {click.invalidReason && <span className="text-xs text-breach">{click.invalidReason}</span>}
                <StatusBadge truth={click.isEligible ? "paid" : "breach"} label={click.isEligible ? "Eligible" : "Invalid"} className="h-5 text-[9.5px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, n) => sum + n, 0);
  return (
    <Panel title={title} description={`${total} total`}>
      <div className="space-y-3 p-5">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet</p>
        ) : (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full">
              {Object.entries(data).map(([status, count]) => (
                <motion.div
                  key={status}
                  className={cn(TRUTH_CLASSES[truthOf(status)], "border-0 bg-current")}
                  initial={{ width: 0 }}
                  animate={{ width: `${(count / total) * 100}%` }}
                />
              ))}
            </div>
            <ul className="space-y-1.5">
              {Object.entries(data).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full bg-current", TRUTH_CLASSES[truthOf(status)].split(" ").find((c) => c.startsWith("text-")))} />
                    {labelOf(status)}
                  </span>
                  <span className="num">{count}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}
