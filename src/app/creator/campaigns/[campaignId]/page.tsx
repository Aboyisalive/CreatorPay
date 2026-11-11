"use client";

import { Suspense, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, BadgeCheck, Circle, Clock, ExternalLink, Landmark, MessageSquare, MousePointerClick, PlusCircle } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { daysUntil, formatDay } from "@/lib/time";
import { DELIVERABLE_TYPES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { CreatorCampaignDetail, CreatorReward, CreatorSubmission, Deliverable } from "@/lib/api-types";
import { CreatorHeader } from "@/components/creator-shell";
import { SubmitDeliverableDrawer } from "@/components/creator/submit-drawer";
import { TrackingLinkCard } from "@/components/creator/widgets";
import { EmptyState, ErrorState } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export default function CreatorCampaignPage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}

function Workspace() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const params = useSearchParams();
  const detailKey = `/api/v1/creators/me/campaigns/${campaignId}`;
  const detail = useApiData<CreatorCampaignDetail>(detailKey);
  const analytics = useApiData<{ clicks: { total: number; eligible: number }; events: { total: number; verified: number; eligible: number } }>(`${detailKey}/analytics`);
  const submissions = useApiData<{ submissions: CreatorSubmission[] }>("/api/v1/creators/me/submissions");
  const rewards = useApiData<{ rewards: CreatorReward[] }>("/api/v1/creators/me/rewards");
  // undefined = nothing picked yet, so honour ?submit=<deliverableId> deep links.
  const [picked, setDrawerFor] = useState<Deliverable | null | undefined>(undefined);

  const deliverables = useMemo(() => detail.data?.campaign.deliverables ?? [], [detail.data]);
  const latestByDeliverable = useMemo(() => {
    const map = new Map<string, CreatorSubmission>();
    for (const s of submissions.data?.submissions ?? []) {
      if (s.campaign.id !== campaignId) continue;
      const current = map.get(s.deliverableId);
      if (!current || new Date(s.submittedAt) > new Date(current.submittedAt)) map.set(s.deliverableId, s);
    }
    return map;
  }, [submissions.data, campaignId]);

  const target = params.get("submit");
  const drawerFor = picked === undefined ? (deliverables.find((d) => d.id === target) ?? null) : picked;

  if (detail.error) return <ErrorState message={detail.error.message} onRetry={() => detail.mutate()} className="m-4" />;
  if (!detail.data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const { campaign, participation, link } = detail.data;
  const reward = rewards.data?.rewards.find((r) => r.campaign.id === campaignId);
  const rules = participation.termVersion?.rewardRules ?? [];
  const done = deliverables.filter((d) => latestByDeliverable.get(d.id)?.status === "APPROVED").length;
  const nextOpen = deliverables.find((d) => {
    const status = latestByDeliverable.get(d.id)?.status;
    return !status || status === "REVISION_REQUESTED" || status === "REJECTED";
  });
  const live = participation.status === "ACTIVE" && campaign.status !== "CLOSED" && campaign.status !== "ARCHIVED";
  const firstRule = rules[0];

  return (
    <>
      <CreatorHeader
        back="/creator/campaigns"
        title={campaign.name}
        subtitle={campaign.businessName}
        right={participation.termVersion && <Tag className="shrink-0">Accepted terms v{participation.termVersion.version}</Tag>}
      />

      <div className="space-y-5 p-4">
        {link?.active ? (
          <TrackingLinkCard
            path={link.path}
            hint={
              firstRule ? (
                <>
                  Earn <Money minor={firstRule.amountMinor} className="font-semibold" /> for each verified {title(firstRule.eventType ?? "event").toLowerCase()} within{" "}
                  {campaign.attributionWindowDays} days of a click on your link.
                </>
              ) : undefined
            }
          />
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Your tracking link is not active. Contact {campaign.businessName} if this is unexpected.</div>
        )}

        <Stagger className="grid grid-cols-2 gap-3">
          <StaggerItem className="space-y-2 rounded-xl border bg-card p-4">
            <p className="eyebrow flex items-center justify-between text-muted-foreground">
              Attribution <MousePointerClick className="size-4" />
            </p>
            <AnimatedNumber value={analytics.data?.clicks.eligible ?? 0} className="num block text-3xl font-semibold" />
            <p className="text-sm text-muted-foreground">Eligible clicks</p>
            <p className="num border-t pt-2 text-xs text-muted-foreground">{(analytics.data?.clicks.total ?? 0).toLocaleString()} total</p>
          </StaggerItem>
          <StaggerItem className="space-y-2 rounded-xl border bg-card p-4">
            <p className="eyebrow flex items-center justify-between text-muted-foreground">
              Outcomes <BadgeCheck className="size-4" />
            </p>
            <AnimatedNumber value={analytics.data?.events.eligible ?? 0} className="num block text-3xl font-semibold" />
            <p className="text-sm text-muted-foreground">Eligible events</p>
            <div className="flex items-center justify-between border-t pt-2">
              {reward ? <Money minor={reward.totalMinor} className="text-xs font-semibold" /> : <span className="text-xs text-muted-foreground">Not calculated</span>}
              {reward && <StatusBadge status={reward.status} dot={false} className="h-5 text-[9px]" />}
            </div>
          </StaggerItem>
        </Stagger>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              Deliverables
              {deliverables.length > 0 && (
                <span className="num rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {done}/{deliverables.length} done
                </span>
              )}
            </h2>
          </div>

          {deliverables.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState title="No deliverables" description="This campaign rewards outcomes only — share your link." />
            </div>
          ) : (
            <Stagger className="space-y-3">
              {deliverables.map((deliverable) => {
                const submission = latestByDeliverable.get(deliverable.id);
                const status = submission?.status;
                const needsAction = status === "REVISION_REQUESTED" || status === "REJECTED";
                const due = daysUntil(deliverable.dueAt);
                return (
                  <StaggerItem key={deliverable.id}>
                    <div className={cn("space-y-3 rounded-xl border bg-card p-4", needsAction && "border-2 border-action/40")}>
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-lg",
                            status === "APPROVED" ? "bg-paid-tint text-paid" : needsAction ? "bg-action-tint text-action" : status ? "bg-info-tint text-info" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {status === "APPROVED" ? <BadgeCheck className="size-5" /> : needsAction ? <AlertTriangle className="size-5" /> : status ? <Clock className="size-5" /> : <Circle className="size-5" />}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="font-heading text-lg leading-tight font-semibold">
                            {deliverable.quantity > 1 && <span className="num text-muted-foreground">{deliverable.quantity}× </span>}
                            {deliverable.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {status ? <StatusBadge status={status} className="h-5 text-[9.5px]" /> : <StatusBadge truth="neutral" label="Not started" dot={false} className="h-5 text-[9.5px]" />}
                            <span className="text-xs text-muted-foreground">
                              {DELIVERABLE_TYPES[deliverable.type]}
                              {deliverable.dueAt && ` · due ${formatDay(deliverable.dueAt)}`}
                            </span>
                            {due !== null && due < 0 && !status && <span className="eyebrow text-breach">Overdue</span>}
                          </div>
                        </div>
                      </div>

                      {submission?.reviewNote && (
                        <div className={cn("flex gap-2 rounded-lg p-3 text-sm", needsAction ? "bg-action-tint" : "bg-muted/50")}>
                          <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <p>
                            <span className="font-medium">Brand feedback: </span>“{submission.reviewNote}”
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-3 text-sm">
                        {submission?.evidenceUrl ? (
                          <a href={submission.evidenceUrl} target="_blank" rel="noreferrer" className="num inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            Proof <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">{submission ? "Evidence sent" : "Awaiting your submission"}</span>
                        )}
                        {live && (!status || needsAction) && (
                          <button type="button" onClick={() => setDrawerFor(deliverable)} className="inline-flex items-center gap-1 font-medium text-brand-deep">
                            {needsAction ? "Re-submit with corrections" : "Submit"} <ArrowRight className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </section>

        {rules.length > 0 && (
          <section className="space-y-2 rounded-xl border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Landmark className="size-4" /> Your agreed rates
            </h2>
            <ul className="divide-y text-sm">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between py-2">
                  <span>Per verified {title(rule.eventType ?? "event").toLowerCase()}</span>
                  <Money minor={rule.amountMinor} className="font-semibold" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {live && nextOpen && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky bottom-24 z-10 px-4">
          <Button size="xl" className="w-full shadow-glow" onClick={() => setDrawerFor(nextOpen)}>
            <PlusCircle /> Submit deliverable
          </Button>
        </motion.div>
      )}

      <SubmitDeliverableDrawer
        campaignId={campaignId}
        campaignName={campaign.name}
        termVersion={participation.termVersion?.version ?? null}
        deliverable={drawerFor}
        open={Boolean(drawerFor)}
        onOpenChange={(open) => !open && setDrawerFor(null)}
        revalidate={["/api/v1/creators/me", "/api/v1/notifications"]}
      />
    </>
  );
}
