"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, ExternalLink, MousePointerClick, Users } from "lucide-react";
import { formatStamp } from "@/lib/time";
import { useCampaign } from "@/components/campaign/use-campaign";
import { EmptyState, KeyValue, LoadingRows, Panel, StatCard } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge } from "@/components/cp/status-badge";

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export default function CampaignOverviewTab() {
  const { id, data } = useCampaign();
  if (!data) return <LoadingRows rows={5} />;
  const { campaign, stats, participants } = data;
  const eligibleRate = stats.rawClicks ? (stats.eligibleClicks / stats.rawClicks) * 100 : 0;

  return (
    <div className="space-y-6">
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StaggerItem>
          <StatCard label="Participants" icon={<Users />} value={<AnimatedNumber value={stats.participants} className="num" />} hint={`${stats.activeParticipants} active`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Eligible clicks"
            icon={<MousePointerClick />}
            value={<AnimatedNumber value={stats.eligibleClicks} className="num" />}
            hint={<span className="num">{eligibleRate.toFixed(1)}% of {stats.rawClicks.toLocaleString()} raw</span>}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Eligible events" icon={<BadgeCheck />} value={<AnimatedNumber value={stats.eligibleEvents} className="num" />} hint={`${stats.totalEvents} received`} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Calculated" value={<Money minor={stats.calculatedMinor} animate />} hint="Awaiting approval" />
        </StaggerItem>
        <StaggerItem>
          <StatCard tone="escrow" label="Approved" value={<Money minor={stats.approvedMinor} animate className="text-escrow" />} hint="Not yet paid" />
        </StaggerItem>
        <StaggerItem>
          <StatCard tone="paid" label="Paid" value={<Money minor={stats.paidMinor} animate />} hint="Provider-confirmed" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Brief" description={campaign.summary ?? undefined}>
          <div className="space-y-5 p-5">
            {campaign.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{campaign.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No long-form brief yet.</p>
            )}
            <dl className="grid gap-4 sm:grid-cols-2">
              <KeyValue label="Objectives">
                <div className="flex flex-wrap gap-1.5">
                  {campaign.objectives.map((objective) => (
                    <span key={objective} className="rounded-sm border bg-muted/50 px-2 py-0.5 text-xs">
                      {title(objective)}
                    </span>
                  ))}
                </div>
              </KeyValue>
              <KeyValue label="Participation">{title(campaign.participationMode)}</KeyValue>
              <KeyValue label="Destination">
                <a href={campaign.destinationUrl} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1 break-all text-brand-deep hover:underline">
                  {campaign.destinationUrl} <ExternalLink className="size-3 shrink-0" />
                </a>
              </KeyValue>
              <KeyValue label="Created">{formatStamp(campaign.createdAt)}</KeyValue>
            </dl>
          </div>
        </Panel>

        <Panel title="Reward rules" description={`Terms v${campaign.currentTermVersion?.version ?? 1}`}>
          <ul className="divide-y">
            {campaign.currentTermVersion?.rewardRules.map((rule) => (
              <li key={rule.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Per verified {title(rule.eventType ?? "event").toLowerCase()}
                    {rule.maxCount ? ` · max ${rule.maxCount}` : ""}
                    {rule.capMinor ? " · capped" : ""}
                  </p>
                </div>
                <Money minor={rule.amountMinor} currency={campaign.currency} className="font-semibold text-escrow" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Creators"
        action={
          <Link href={`/dashboard/campaigns/${id}/participants`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep hover:underline">
            Manage <ArrowRight className="size-4" />
          </Link>
        }
      >
        {participants.length === 0 ? (
          <EmptyState icon={<Users />} title="No creators yet" description="Invite creators by email from the Participants tab." />
        ) : (
          <ul className="divide-y">
            {participants.slice(0, 6).map((participant) => (
              <li key={participant.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{participant.creator.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{participant.creator.email}</p>
                </div>
                <span className="num text-sm text-muted-foreground">{participant.clicks} clicks · {participant.events} events</span>
                {participant.latestReward ? (
                  <span className="flex items-center gap-2">
                    <Money minor={participant.latestReward.totalMinor} className="text-sm font-semibold" />
                    <StatusBadge status={participant.latestReward.status} />
                  </span>
                ) : (
                  <StatusBadge status={participant.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
