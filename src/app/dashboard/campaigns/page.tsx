"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useApiData } from "@/lib/swr";
import type { CampaignListItem, Overview } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { CampaignTable } from "@/components/campaign-table";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingRows, PageHeader } from "@/components/cp/blocks";
import { FadeIn } from "@/components/cp/motion";

export default function CampaignsPage() {
  const can = useCan();
  const { data, error, mutate } = useApiData<{ campaigns: CampaignListItem[] }>("/api/v1/campaigns");
  const overview = useApiData<Overview>("/api/v1/workspaces/current/overview");

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader
          eyebrow="Campaigns"
          title="All campaigns"
          description="Drafts, live campaigns and the history of everything you've run."
          actions={
            can.manage && (
              <Button asChild>
                <Link href="/dashboard/campaigns/new">
                  <Plus /> New campaign
                </Link>
              </Button>
            )
          }
        />
      </FadeIn>
      <FadeIn delay={0.08}>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : !data ? (
          <div className="rounded-lg border bg-card">
            <LoadingRows rows={5} />
          </div>
        ) : (
          <CampaignTable campaigns={data.campaigns} telemetry={overview.data?.campaigns} canCreate={can.manage} />
        )}
      </FadeIn>
    </div>
  );
}
