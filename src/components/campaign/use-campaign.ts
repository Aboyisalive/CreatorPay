"use client";

import { useParams } from "next/navigation";
import { useApiData } from "@/lib/swr";
import type { CampaignDetail } from "@/lib/api-types";

export function useCampaignId() {
  return useParams<{ campaignId: string }>().campaignId;
}

/** Shared, SWR-deduped campaign detail for the header and every tab. */
export function useCampaign() {
  const id = useCampaignId();
  const result = useApiData<CampaignDetail>(id ? `/api/v1/campaigns/${id}` : null);
  return { id, ...result };
}

/** Prefix used to revalidate everything under one campaign after a mutation. */
export function campaignKeys(id: string) {
  return [`/api/v1/campaigns/${id}`, "/api/v1/workspaces/current/overview", "/api/v1/campaigns"];
}
