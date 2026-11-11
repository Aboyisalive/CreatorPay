"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Download, FileCheck2, Landmark, Lock, MousePointerClick, Plus, Scale, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useApiData } from "@/lib/swr";
import type { CampaignListItem, Overview } from "@/lib/api-types";
import { formatStamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useCan, useSession } from "@/components/session";
import { usePaidLabel } from "@/components/rail";
import { CampaignTable } from "@/components/campaign-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, LoadingRows, PageHeader, StatCard } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { AnimatedNumber, FadeIn, Stagger, StaggerItem } from "@/components/cp/motion";

export default function OverviewPage() {
  const { workspace } = useSession();
  const can = useCan();
  const overview = useApiData<Overview>("/api/v1/workspaces/current/overview", { refreshInterval: 60_000 });
  const campaigns = useApiData<{ campaigns: CampaignListItem[] }>("/api/v1/campaigns");
  const data = overview.data;
  const paidLabel = usePaidLabel();

  return (
    <div className="space-y-8">
      <FadeIn>
        <PageHeader
          eyebrow={workspace?.name}
          title="Business overview"
          description="Everything that needs a decision today, then the health of every campaign."
          meta={
            <span className="num text-xs text-muted-foreground">
              Snapshot {formatStamp(new Date())}
            </span>
          }
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/dashboard/activity">
                  <Download /> Audit trail
                </Link>
              </Button>
              {can.manage && (
                <Button asChild>
                  <Link href="/dashboard/campaigns/new">
                    <Plus /> New campaign
                  </Link>
                </Button>
              )}
            </>
          }
        />
      </FadeIn>

      {overview.error ? (
        <ErrorState message={overview.error.message} onRetry={() => overview.mutate()} />
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-3">
          <StaggerItem>
            <QueueCard
              tone="action"
              eyebrow="Review queue"
              loading={!data}
              title={
                <>
                  <AnimatedNumber value={data?.queues.submissionsToReview ?? 0} /> submission
                  {data?.queues.submissionsToReview === 1 ? "" : "s"} to review
                </>
              }
              body="Deliverable evidence waiting for an approve, revision or reject decision."
              footer="Open campaigns"
              href="/dashboard/campaigns"
              icon={<FileCheck2 />}
            />
          </StaggerItem>
          <StaggerItem>
            {data?.queues.unmatchedDeposits !== null ? (
              <QueueCard
                tone="breach"
                eyebrow="Inbound deposits"
                loading={!data}
                title={
                  <>
                    <AnimatedNumber value={data?.queues.unmatchedDeposits?.count ?? 0} /> unmatched deposit
                    {data?.queues.unmatchedDeposits?.count === 1 ? "" : "s"}
                  </>
                }
                amount={data?.queues.unmatchedDeposits?.totalMinor}
                body="Bank credits that arrived without a recognisable funding reference. Match them to a campaign."
                footer="Resolve in Payments"
                href="/dashboard/payments"
                icon={<Landmark />}
              />
            ) : (
              <QueueCard
                tone="neutral"
                eyebrow="Inbound deposits"
                loading={false}
                title="Finance only"
                body="Deposit matching is visible to Owners, Admins and Finance users."
                icon={<Lock />}
              />
            )}
          </StaggerItem>
          <StaggerItem>
            <QueueCard
              tone="escrow"
              eyebrow="Finance sign-off"
              loading={!data}
              title={
                <>
                  <AnimatedNumber value={data?.queues.rewardsAwaitingApproval.count ?? 0} /> reward
                  {data?.queues.rewardsAwaitingApproval.count === 1 ? "" : "s"} awaiting approval
                </>
              }
              amount={data?.queues.rewardsAwaitingApproval.totalMinor}
              body="Calculated from verified, eligible events. Approval does not move money."
              footer="Review ledgers"
              href="/dashboard/campaigns"
              icon={<Scale />}
            />
          </StaggerItem>
        </Stagger>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow text-muted-foreground">Campaign &amp; conversion telemetry</h2>
          <span className="eyebrow hidden text-muted-foreground sm:block">Live from your ledger</span>
        </div>
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StaggerItem>
            <StatCard label="Active campaigns" icon={<Clock3 />} value={<Num value={data?.totals.activeCampaigns} />} hint="Published now" />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Creators"
              icon={<Users />}
              value={<Num value={data?.totals.creators} />}
              hint={data ? <span className="num">{data.totals.activeCreators} active</span> : null}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Eligible clicks"
              icon={<MousePointerClick />}
              value={<Num value={data?.totals.eligibleClicks} />}
              hint={
                data && data.totals.clicks ? (
                  <span className="num text-paid">
                    {((data.totals.eligibleClicks / data.totals.clicks) * 100).toFixed(1)}% of {data.totals.clicks.toLocaleString()}
                  </span>
                ) : (
                  "Bots & invalid excluded"
                )
              }
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Verified events" icon={<BadgeCheck />} value={<Num value={data?.totals.verifiedEvents} />} hint="Test events excluded" />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              tone="escrow"
              label="Rewards payable"
              value={data ? <Money minor={data.totals.payableMinor} animate className="text-escrow" /> : <Skeleton className="h-7 w-24" />}
              hint="Approved, not yet paid"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              tone="paid"
              label="Paid via bank"
              value={data ? <Money minor={data.totals.paidMinor} animate /> : <Skeleton className="h-7 w-24 bg-white/30" />}
              hint={`${paidLabel} only`}
            />
          </StaggerItem>
        </Stagger>
      </section>

      <FadeIn delay={0.15}>
        {campaigns.error ? (
          <ErrorState message={campaigns.error.message} onRetry={() => campaigns.mutate()} />
        ) : !campaigns.data ? (
          <div className="rounded-lg border bg-card">
            <LoadingRows rows={4} />
          </div>
        ) : (
          <CampaignTable campaigns={campaigns.data.campaigns} telemetry={data?.campaigns} canCreate={can.manage} />
        )}
      </FadeIn>

      <Stagger inView className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: <MousePointerClick />,
            title: "Last eligible click attribution",
            body: "Each conversion is credited to the creator whose eligible link was clicked last, inside the campaign's disclosed window.",
            tone: "bg-paid-tint text-paid",
          },
          {
            icon: <Lock />,
            title: "Terms lock on publish",
            body: "Creators accept a specific terms version. Changes create a new version — accepted terms are never silently rewritten.",
            tone: "bg-brand-tint text-brand-deep",
          },
          {
            icon: <Scale />,
            title: "Approved is not paid",
            body: "Rewards move from calculated → approved → payable → paid. Only a provider-confirmed payout is shown as paid.",
            tone: "bg-escrow-tint text-escrow",
          },
        ].map((item) => (
          <StaggerItem key={item.title} className="flex gap-4 rounded-lg border bg-muted/30 p-5">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-md [&_svg]:size-5", item.tone)}>{item.icon}</span>
            <div className="space-y-1">
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function Num({ value }: { value: number | undefined }) {
  if (value === undefined) return <Skeleton className="h-7 w-16" />;
  return <AnimatedNumber value={value} className="num" />;
}

const QUEUE_TONES = {
  action: "border-t-action",
  breach: "border-t-breach",
  escrow: "border-t-escrow",
  neutral: "border-t-border",
} as const;

const QUEUE_EYEBROW = {
  action: "bg-action-tint text-action",
  breach: "bg-breach-tint text-breach",
  escrow: "bg-escrow-tint text-escrow",
  neutral: "bg-muted text-muted-foreground",
} as const;

function QueueCard({
  tone,
  eyebrow,
  title,
  amount,
  body,
  footer,
  href,
  icon,
  loading,
}: {
  tone: keyof typeof QUEUE_TONES;
  eyebrow: string;
  title: ReactNode;
  amount?: string;
  body: string;
  footer?: string;
  href?: string;
  icon: ReactNode;
  loading: boolean;
}) {
  return (
    <div className={cn("flex h-full flex-col rounded-lg border border-t-[3px] bg-card transition-shadow hover:shadow-lift", QUEUE_TONES[tone])}>
      <div className="flex-1 space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("eyebrow rounded-sm px-2 py-1 text-[10px]", QUEUE_EYEBROW[tone])}>{eyebrow}</span>
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-3/4" />
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-heading text-xl font-semibold tracking-tight">{title}</h3>
            {amount && amount !== "0" && <Money minor={amount} className={cn("font-semibold", tone === "breach" ? "text-breach" : "text-escrow")} />}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {footer && href && (
        <Link
          href={href}
          className="group flex items-center justify-between border-t px-5 py-3 text-sm font-medium text-brand-deep transition-colors hover:bg-muted/40"
        >
          {footer}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
