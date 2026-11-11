"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Megaphone, Search, Users } from "lucide-react";
import type { CampaignListItem, Overview } from "@/lib/api-types";
import { formatDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";

const STATUSES = ["ALL", "DRAFT", "PUBLISHED", "PAUSED", "CLOSED", "ARCHIVED"];
const FUNDING = ["ALL", "UNFUNDED", "AWAITING_FUNDS", "FUNDED"];

export function campaignCode(id: string) {
  return `CP-${id.slice(-6).toUpperCase()}`;
}

export function CampaignTable({
  campaigns,
  telemetry,
  canCreate,
}: {
  campaigns: CampaignListItem[];
  telemetry?: Overview["campaigns"];
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [funding, setFunding] = useState("ALL");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return campaigns.filter(
      (campaign) =>
        (status === "ALL" || campaign.status === status) &&
        (funding === "ALL" || campaign.fundingStatus === funding) &&
        (!needle ||
          campaign.name.toLowerCase().includes(needle) ||
          campaignCode(campaign.id).toLowerCase().includes(needle)),
    );
  }, [campaigns, query, status, funding]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or code…"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.charAt(0) + value.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={funding} onValueChange={setFunding}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNDING.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === "ALL" ? "All funding" : value === "AWAITING_FUNDS" ? "Awaiting funds" : value.charAt(0) + value.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground md:ml-auto">
          Showing <span className="num font-medium text-foreground">{rows.length}</span> of {campaigns.length}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No campaigns yet"
          description="Create a campaign to define objectives, reward rules and deliverables, then invite creators."
          action={
            canCreate && (
              <Button asChild>
                <Link href="/dashboard/campaigns/new">Create your first campaign</Link>
              </Button>
            )
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search />} title="No campaigns match these filters" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="eyebrow h-10 pl-4">Campaign</TableHead>
              <TableHead className="eyebrow h-10">Status</TableHead>
              <TableHead className="eyebrow h-10">Funding</TableHead>
              <TableHead className="eyebrow h-10 text-center">Creators</TableHead>
              <TableHead className="eyebrow h-10 min-w-[200px]">Telemetry</TableHead>
              <TableHead className="eyebrow h-10 pr-4 text-right">Budget</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence initial={false}>
              {rows.map((campaign, index) => {
                const stats = telemetry?.[campaign.id];
                const clicks = stats?.clicks ?? campaign.counts.clickEvents;
                const eligibleRate = stats && stats.clicks ? (stats.eligibleClicks / stats.clicks) * 100 : 0;
                return (
                  <motion.tr
                    key={campaign.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.035, 0.3) } }}
                    exit={{ opacity: 0 }}
                    onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
                    className="group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <TableCell className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted/50 text-muted-foreground">
                          <Megaphone className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/campaigns/${campaign.id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="block max-w-[280px] truncate font-medium hover:underline"
                          >
                            {campaign.name}
                          </Link>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <Tag>{campaignCode(campaign.id)}</Tag>
                            <span>
                              {campaign.startAt ? `${formatDay(campaign.startAt)} → ${formatDay(campaign.endAt)}` : `Created ${formatDay(campaign.createdAt)}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.fundingStatus} dot={false} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="num inline-flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" />
                        {campaign.counts.participants}
                      </span>
                    </TableCell>
                    <TableCell>
                      {clicks === 0 ? (
                        <span className="text-sm text-muted-foreground italic">No telemetry yet</span>
                      ) : (
                        <div className="max-w-[220px] space-y-1.5">
                          <div className="num flex justify-between text-xs">
                            <span>{clicks.toLocaleString()} clicks</span>
                            {stats && <span className="text-muted-foreground">{eligibleRate.toFixed(0)}% eligible</span>}
                          </div>
                          {stats && <Progress value={eligibleRate} className="h-1.5 [&>div]:bg-brand" />}
                          <div className="text-xs text-muted-foreground">
                            {(stats?.verifiedEvents ?? campaign.counts.conversionEvents).toLocaleString()}{" "}
                            {stats ? "verified events" : "events"}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Money minor={campaign.budgetMinor} currency={campaign.currency} className="font-semibold" />
                      <div className="text-xs text-muted-foreground">
                        {campaign.rewardRules.length} rule{campaign.rewardRules.length === 1 ? "" : "s"}
                      </div>
                    </TableCell>
                    <TableCell className="pr-3">
                      <ChevronRight className={cn("size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5")} />
                    </TableCell>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
