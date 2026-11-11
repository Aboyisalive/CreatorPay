"use client";

import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { formatDay } from "@/lib/time";
import type { CreatorCampaign } from "@/lib/api-types";
import { CreatorHeader } from "@/components/creator-shell";
import { EmptyState, ErrorState } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge } from "@/components/cp/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreatorCampaignsPage() {
  const { data, error, mutate } = useApiData<{ campaigns: CreatorCampaign[] }>("/api/v1/creators/me/campaigns");

  return (
    <>
      <CreatorHeader title="Campaigns" subtitle="Everything you've joined" />
      <div className="space-y-3 p-4">
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : !data ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : data.campaigns.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState icon={<Megaphone />} title="No campaigns yet" description="Accept an invitation to see the campaign here." />
          </div>
        ) : (
          <Stagger className="space-y-3">
            {data.campaigns.map((item) => (
              <StaggerItem key={item.participantId}>
                <Link href={`/creator/campaigns/${item.campaign.id}`} className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-lift">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status === "ACTIVE" ? item.campaign.status : item.status} className="h-5 text-[9.5px]" />
                      <span className="truncate text-xs text-muted-foreground">{item.campaign.businessName}</span>
                    </div>
                    <p className="font-heading truncate text-lg font-semibold">{item.campaign.name}</p>
                    <p className="num text-xs text-muted-foreground">
                      Terms v{item.termVersion ?? "—"} · ends {formatDay(item.campaign.endAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    {item.reward ? <Money minor={item.reward.totalMinor} className="font-semibold" /> : <span className="text-xs text-muted-foreground">No rewards yet</span>}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </>
  );
}
