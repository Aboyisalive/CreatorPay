"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Archive, Calendar, Download, Landmark, Lock, Pause, Play, Rocket, Square } from "lucide-react";
import { post, useApiData, useMutation } from "@/lib/swr";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Submission } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { campaignKeys, useCampaign } from "@/components/campaign/use-campaign";
import { campaignCode } from "@/components/campaign-table";
import { ActionDialog } from "@/components/cp/action-dialog";
import { ErrorState } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { FadeIn } from "@/components/cp/motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const can = useCan();
  const run = useMutation();
  const { id, data, error, mutate } = useCampaign();
  const submissions = useApiData<{ submissions: Submission[] }>(id ? `/api/v1/campaigns/${id}/submissions` : null);
  const base = `/dashboard/campaigns/${id}`;

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;

  const campaign = data?.campaign;
  const pending = submissions.data?.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW").length ?? 0;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/terms`, label: `Terms v${campaign?.currentTermVersion?.version ?? 1}` },
    { href: `${base}/deliverables`, label: "Deliverables" },
    { href: `${base}/participants`, label: "Participants", count: data?.stats.participants },
    { href: `${base}/submissions`, label: "Submissions", count: pending, highlight: pending > 0 },
    { href: `${base}/events`, label: "Conversion events", count: data?.stats.totalEvents },
    { href: `${base}/rewards`, label: "Rewards ledger" },
    { href: `${base}/funding`, label: "Funding" },
    { href: `${base}/analytics`, label: "Analytics" },
  ];

  const lifecycle = (action: string, success: string) =>
    run(() => post(`/api/v1/campaigns/${id}/${action}`), { success, revalidate: campaignKeys(id) });

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/campaigns">Campaigns</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage className="num">{campaignCode(id)}</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      <FadeIn className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          {campaign ? (
            <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[2.25rem]">{campaign.name}</h1>
          ) : (
            <Skeleton className="h-10 w-96 max-w-full" />
          )}
          {campaign && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge status={campaign.status} />
              <Tag>{campaignCode(campaign.id)}</Tag>
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {campaign.startAt ? `${formatDay(campaign.startAt)} → ${formatDay(campaign.endAt)}` : "No schedule set"}
              </span>
              <span>· Last eligible click, {campaign.attributionWindowDays}-day window</span>
            </div>
          )}
          {campaign && (
            <Link
              href={`${base}/funding`}
              className="inline-flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-shadow hover:shadow-lift"
            >
              <span className="grid size-9 place-items-center rounded-md bg-brand text-on-brand">
                <Landmark className="size-4" />
              </span>
              <span className="space-y-0.5">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  Reward budget <StatusBadge status={campaign.fundingStatus} dot={false} className="h-5 text-[9.5px]" />
                </span>
                <Money minor={campaign.budgetMinor} currency={campaign.currency} className="block text-lg font-semibold" />
              </span>
            </Link>
          )}
        </div>

        {campaign && can.manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/v1/campaigns/${id}/report.csv`}>
                <Download /> Report CSV
              </a>
            </Button>
            {campaign.status === "DRAFT" && (
              <PublishButton id={id} onDone={() => mutate()} />
            )}
            {campaign.status === "PUBLISHED" && (
              <ActionDialog
                trigger={
                  <Button variant="outline">
                    <Pause /> Pause
                  </Button>
                }
                icon={<Pause />}
                tone="action"
                title="Pause click recording?"
                description="Creator links keep redirecting, but new clicks stop counting until you resume."
                confirmLabel="Pause campaign"
                onConfirm={() => lifecycle("pause", "Campaign paused")}
              />
            )}
            {campaign.status === "PAUSED" && (
              <Button onClick={() => lifecycle("resume", "Campaign resumed")}>
                <Play /> Resume
              </Button>
            )}
            {(campaign.status === "PUBLISHED" || campaign.status === "PAUSED") && (
              <ActionDialog
                trigger={
                  <Button variant="destructive">
                    <Square /> Close
                  </Button>
                }
                icon={<Square />}
                tone="destructive"
                title="Close this campaign?"
                description="No new participation or clicks. Outstanding submissions, events and rewards stay open for settlement."
                confirmLabel="Close campaign"
                onConfirm={() => lifecycle("close", "Campaign closed")}
              />
            )}
            {(campaign.status === "DRAFT" || campaign.status === "CLOSED") && (
              <ActionDialog
                trigger={
                  <Button variant="ghost">
                    <Archive /> Archive
                  </Button>
                }
                icon={<Archive />}
                title="Archive this campaign?"
                description="It stays in your history and audit trail, read-only."
                confirmLabel="Archive"
                onConfirm={() => lifecycle("archive", "Campaign archived")}
              />
            )}
          </div>
        )}
      </FadeIn>

      <nav className="scrollbar-none -mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0" aria-label="Campaign sections">
        <ul className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-2 px-3 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={cn(
                        "num rounded-sm px-1.5 text-[11px] leading-5",
                        tab.highlight ? "bg-brand text-on-brand" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.count.toLocaleString()}
                    </span>
                  )}
                  {active && (
                    <motion.span layoutId="campaign-tab" className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-brand" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
        {children}
      </motion.div>
    </div>
  );
}

function PublishButton({ id, onDone }: { id: string; onDone: () => void }) {
  const run = useMutation();
  return (
    <ActionDialog
      trigger={
        <Button>
          <Rocket /> Publish
        </Button>
      }
      icon={<Lock />}
      title="Publish and lock terms?"
      description="Creators will accept this exact terms version. Later changes require a new version."
      confirmLabel="Publish campaign"
      onConfirm={async () => {
        const result = await run(() => post(`/api/v1/campaigns/${id}/publish`), {
          success: "Published — terms locked",
          revalidate: campaignKeys(id),
        });
        if (result) onDone();
        return result ? undefined : false;
      }}
    />
  );
}
