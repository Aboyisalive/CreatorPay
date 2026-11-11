"use client";

import { useApiData } from "@/lib/swr";
import type { Deliverable } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { useCampaign } from "@/components/campaign/use-campaign";
import { DeliverablesEditor } from "@/components/deliverables-editor";
import { ErrorState, LoadingRows, Panel } from "@/components/cp/blocks";

export default function DeliverablesTab() {
  const can = useCan();
  const { id, data: campaign } = useCampaign();
  const key = `/api/v1/campaigns/${id}/deliverables`;
  const { data, error, mutate } = useApiData<{ deliverables: Deliverable[] }>(key);

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!data) return <LoadingRows />;

  return (
    <Panel
      title="Deliverables matrix"
      description="What each creator must submit, and the evidence reviewers check. Approval of content is separate from conversion rewards."
    >
      <div className="p-5">
        <DeliverablesEditor
          campaignId={id}
          deliverables={data.deliverables}
          readOnly={!can.manage || campaign?.campaign.status === "ARCHIVED"}
          onChange={(list) => mutate({ deliverables: list }, { revalidate: true })}
        />
      </div>
    </Panel>
  );
}
