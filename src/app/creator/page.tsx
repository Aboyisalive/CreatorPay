"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Landmark, Megaphone, Upload, Wallet } from "lucide-react";
import { useApiData } from "@/lib/swr";
import type { BankDetails, CreatorCampaign, CreatorReward, CreatorSubmission } from "@/lib/api-types";
import { useSession } from "@/components/session";
import { CreatorHeader } from "@/components/creator-shell";
import { EarningsLedger, TrackingLinkCard } from "@/components/creator/widgets";
import { EmptyState, initials } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { FadeIn, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreatorHome() {
  const { user } = useSession();
  const rewards = useApiData<{ rewards: CreatorReward[] }>("/api/v1/creators/me/rewards");
  const campaigns = useApiData<{ campaigns: CreatorCampaign[] }>("/api/v1/creators/me/campaigns");
  const submissions = useApiData<{ submissions: CreatorSubmission[] }>("/api/v1/creators/me/submissions");
  const bank = useApiData<{ bankDetails: BankDetails | null }>("/api/v1/me/bank-details");
  const name = user.creatorProfile?.displayName ?? user.name;
  const revisions = submissions.data?.submissions.filter((s) => s.status === "REVISION_REQUESTED") ?? [];
  const active = campaigns.data?.campaigns.filter((c) => c.status === "ACTIVE") ?? [];
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date());

  return (
    <>
      <CreatorHeader
        leading={
          <Avatar className="size-10 ring-2 ring-brand">
            <AvatarFallback className="bg-brand-tint font-semibold text-brand-deep">{initials(name)}</AvatarFallback>
          </Avatar>
        }
        title={`Hi, ${name.split(" ")[0]}`}
        subtitle={`${active.length} active campaign${active.length === 1 ? "" : "s"}`}
      />

      <div className="space-y-5 p-4">
        <FadeIn className="rounded-xl border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="eyebrow flex items-center gap-2">
              <Wallet className="size-4" /> Earnings ledger
            </h2>
            <span className="eyebrow text-muted-foreground">{month}</span>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Balances stay split by status. Only bank-confirmed money shows as paid.</p>
          {rewards.data ? <EarningsLedger rewards={rewards.data.rewards} /> : <Skeleton className="h-64 w-full" />}
        </FadeIn>

        {bank.data && !bank.data.bankDetails && (
          <FadeIn delay={0.05}>
            <Link href="/creator/profile/bank" className="flex items-center gap-3 rounded-xl border-2 border-brand bg-brand-tint p-4 transition-shadow hover:shadow-glow">
              <span className="grid size-10 place-items-center rounded-md bg-brand text-on-brand">
                <Landmark className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">Add your payout bank account</span>
                <span className="block text-sm text-muted-foreground">Needed before any reward can be paid to you.</span>
              </span>
              <ArrowRight className="size-4" />
            </Link>
          </FadeIn>
        )}

        {revisions.map((submission) => (
          <FadeIn key={submission.id} className="overflow-hidden rounded-xl border border-l-4 border-action/30 border-l-action bg-action-tint p-4">
            <p className="eyebrow flex items-center gap-2 text-action">
              <AlertTriangle className="size-4" /> Revision requested
            </p>
            <p className="mt-2 font-heading text-lg font-semibold">{submission.deliverable.name}</p>
            <p className="text-xs text-muted-foreground">{submission.campaign.name}</p>
            {submission.reviewNote && <p className="mt-2 text-sm">“{submission.reviewNote}”</p>}
            <div className="mt-3 flex justify-end">
              <Button variant="action" asChild>
                <Link href={`/creator/campaigns/${submission.campaign.id}?submit=${submission.deliverableId}`}>
                  <Upload /> Resubmit
                </Link>
              </Button>
            </div>
          </FadeIn>
        ))}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Active campaigns</h2>
            <Link href="/creator/campaigns" className="text-sm font-medium text-brand-deep">
              See all
            </Link>
          </div>
          {!campaigns.data ? (
            <Skeleton className="h-56 w-full" />
          ) : active.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState icon={<Megaphone />} title="No active campaigns" description="When a business invites you, accept the terms from the email link to start." />
            </div>
          ) : (
            <Stagger className="space-y-3">
              {active.map((item) => (
                <StaggerItem key={item.participantId} className="space-y-4 rounded-xl border bg-card p-4">
                  <Link href={`/creator/campaigns/${item.campaign.id}`} className="block space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={item.campaign.status} />
                      <span className="text-xs text-muted-foreground">{item.campaign.businessName}</span>
                    </div>
                    <h3 className="font-heading text-xl font-semibold tracking-tight">{item.campaign.name}</h3>
                    <p className="num text-sm text-muted-foreground">
                      {item.eligibleClicks.toLocaleString()} eligible clicks · {item.eligibleEvents} eligible events
                    </p>
                  </Link>
                  {item.reward && (
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                      <span className="text-sm text-muted-foreground">Latest reward</span>
                      <span className="flex items-center gap-2">
                        <Money minor={item.reward.totalMinor} className="font-semibold" />
                        <StatusBadge status={item.reward.status} className="h-5 text-[9.5px]" />
                      </span>
                    </div>
                  )}
                  {item.link && <TrackingLinkCard path={item.link.path} compact />}
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </div>
    </>
  );
}
