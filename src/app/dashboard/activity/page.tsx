"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { History } from "lucide-react";
import { useApiData } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import type { Activity } from "@/lib/api-types";
import { EmptyState, ErrorState, initials, LoadingRows, PageHeader, Panel } from "@/components/cp/blocks";
import { FadeIn } from "@/components/cp/motion";
import { Tag } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const PAGE = 30;

function describe(action: string) {
  const [entity, verb] = action.split(".");
  return `${(verb ?? "").replace(/_/g, " ")} ${entity?.replace(/_/g, " ") ?? ""}`.trim();
}

export default function ActivityPage() {
  const [page, setPage] = useState(0);
  const { data, error, mutate } = useApiData<{ activities: Activity[]; total: number }>(
    `/api/v1/workspaces/current/activity?take=${PAGE}&skip=${page * PAGE}`,
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader eyebrow="Governance" title="Audit trail" description="Every term change, review decision, reward adjustment and payout, with who did it and when." />
      </FadeIn>
      <Panel>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} className="m-5" />
        ) : !data ? (
          <LoadingRows rows={6} />
        ) : data.activities.length === 0 ? (
          <EmptyState icon={<History />} title="No activity yet" />
        ) : (
          <ol className="divide-y">
            {data.activities.map((item, index) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0, transition: { delay: Math.min(index * 0.02, 0.3) } }}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-xs font-semibold">{initials(item.actor?.name ?? "System")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.actor?.name ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{describe(item.action)}</span>
                  </p>
                  <p className="num text-xs text-muted-foreground">{formatStamp(item.createdAt)}</p>
                </div>
                <Tag>{item.action}</Tag>
              </motion.li>
            ))}
          </ol>
        )}
        {data && data.total > PAGE && (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="num text-muted-foreground">
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
