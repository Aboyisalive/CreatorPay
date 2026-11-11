"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Clock, ExternalLink, FileSearch, Link2, MessageSquare, RotateCcw, Search, XCircle } from "lucide-react";
import { post, useApiData, useMutation } from "@/lib/swr";
import { formatDistanceToNowStrict, formatStamp } from "@/lib/time";
import { DELIVERABLE_TYPES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Submission } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { campaignKeys, useCampaignId } from "@/components/campaign/use-campaign";
import { ActionDialog } from "@/components/cp/action-dialog";
import { EmptyState, ErrorState, initials, LoadingRows } from "@/components/cp/blocks";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Under review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REVISION_REQUESTED", label: "Revision requested" },
  { key: "REJECTED", label: "Rejected" },
];

const isPending = (status: string) => status === "SUBMITTED" || status === "UNDER_REVIEW";

export default function SubmissionsTab() {
  const id = useCampaignId();
  const can = useCan();
  const run = useMutation();
  const { data, error, mutate } = useApiData<{ submissions: Submission[] }>(`/api/v1/campaigns/${id}/submissions`);
  const [filter, setFilter] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = useMemo(() => data?.submissions ?? [], [data]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: all.length, PENDING: 0, APPROVED: 0, REVISION_REQUESTED: 0, REJECTED: 0 };
    for (const item of all) result[isPending(item.status) ? "PENDING" : item.status] = (result[isPending(item.status) ? "PENDING" : item.status] ?? 0) + 1;
    return result;
  }, [all]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((item) => filter === "ALL" || (filter === "PENDING" ? isPending(item.status) : item.status === filter))
      .filter(
        (item) =>
          !needle ||
          item.participant.creatorProfile.displayName.toLowerCase().includes(needle) ||
          item.deliverable.name.toLowerCase().includes(needle),
      )
      .sort((a, b) => (sort === "new" ? -1 : 1) * (new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()));
  }, [all, filter, query, sort]);

  const selected = rows.find((item) => item.id === selectedId) ?? rows[0] ?? null;

  const review = (action: "approve" | "reject" | "request-revision", note: string, success: string) =>
    run(() => post(`/api/v1/submissions/${selected!.id}/${action}`, { reviewNote: note || null }), {
      success,
      revalidate: [...campaignKeys(id), "/api/v1/notifications"],
    });

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!data) return <LoadingRows rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setFilter(item.key);
                setSelectedId(null);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                active ? "border-ink bg-ink text-background" : "bg-card hover:bg-muted",
              )}
            >
              {item.key === "PENDING" && counts.PENDING > 0 && <span className="size-1.5 animate-pulse-dot rounded-full bg-brand text-brand" />}
              {item.label}
              <span className={cn("num rounded-sm px-1.5 text-[11px]", active ? "bg-background/20" : "bg-muted text-muted-foreground")}>{counts[item.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Creator or deliverable…" className="h-9 pl-9" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Newest first (WAT)</SelectItem>
            <SelectItem value="old">Oldest first (WAT)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card">
          <EmptyState icon={<FileSearch />} title="Nothing here" description="Submissions matching this filter will appear as creators send evidence." />
        </div>
      ) : (
        <div className="grid overflow-hidden rounded-lg border bg-card lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="border-b lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
              <span className="eyebrow text-muted-foreground">Queue ({rows.length})</span>
              <span className="eyebrow text-muted-foreground">WAT</span>
            </div>
            <ul className="max-h-[640px] space-y-2 overflow-y-auto p-3">
              {rows.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "relative w-full space-y-3 rounded-lg border p-3.5 text-left transition-colors",
                        active ? "border-brand bg-brand-tint/60" : "hover:bg-muted/50",
                      )}
                    >
                      {active && <motion.span layoutId="queue-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-brand" />}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-card text-xs font-semibold">{initials(item.participant.creatorProfile.displayName)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm font-medium">{item.participant.creatorProfile.displayName}</span>
                        </div>
                        <StatusBadge status={item.status} className="h-5 text-[9.5px]" />
                      </div>
                      <p className="font-heading leading-snug font-semibold">{item.deliverable.name}</p>
                      <div className="num flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" /> {formatDistanceToNowStrict(item.submittedAt)}
                        </span>
                        <span>{DELIVERABLE_TYPES[item.deliverable.type] ?? item.deliverable.type}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex min-w-0 flex-col"
              >
                <div className="flex-1 space-y-6 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selected.status} />
                    <Tag>#{selected.id.slice(-8).toUpperCase()}</Tag>
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold tracking-tight">{selected.deliverable.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.participant.creatorProfile.displayName} · {selected.participant.creatorProfile.user.email}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="eyebrow text-muted-foreground">Evidence</p>
                    {selected.evidenceUrl && (
                      <a
                        href={selected.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 rounded-md border bg-muted/40 p-3 transition-colors hover:border-brand"
                      >
                        <span className="grid size-9 place-items-center rounded-md bg-brand-tint text-brand-deep">
                          <Link2 className="size-4" />
                        </span>
                        <span className="num min-w-0 flex-1 truncate text-sm">{selected.evidenceUrl}</span>
                        <ExternalLink className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </a>
                    )}
                    {selected.evidenceText && <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-line">{selected.evidenceText}</p>}
                    <p className="num text-xs text-muted-foreground">Submitted {formatStamp(selected.submittedAt)}</p>
                  </div>

                  {selected.note && (
                    <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                      <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Creator note</p>
                        <p className="text-muted-foreground">{selected.note}</p>
                      </div>
                    </div>
                  )}

                  {selected.reviewNote && (
                    <div className="rounded-lg border border-action/25 bg-action-tint p-4 text-sm text-action">
                      <p className="font-medium">Review note {selected.reviewedAt && `· ${formatStamp(selected.reviewedAt)}`}</p>
                      <p>{selected.reviewNote}</p>
                    </div>
                  )}

                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Approving content records that the deliverable was met. It does not verify conversions or move money.
                  </p>
                </div>

                {can.review && isPending(selected.status) && (
                  <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 p-4 backdrop-blur">
                    <ActionDialog
                      trigger={
                        <Button variant="destructive">
                          <XCircle /> Reject
                        </Button>
                      }
                      icon={<XCircle />}
                      tone="destructive"
                      title={`Reject ${selected.deliverable.name}?`}
                      description={`${selected.participant.creatorProfile.displayName} will be notified with your reason.`}
                      note={{ label: "Reason for rejection", required: true, placeholder: "Which requirement wasn't met?" }}
                      confirmLabel="Reject submission"
                      onConfirm={(note) => review("reject", note, "Submission rejected")}
                    />
                    <ActionDialog
                      trigger={
                        <Button variant="action">
                          <RotateCcw /> Request revision
                        </Button>
                      }
                      icon={<RotateCcw />}
                      tone="action"
                      title={`Request revision from ${selected.participant.creatorProfile.displayName}`}
                      description={selected.deliverable.name}
                      warning={
                        <>
                          This moves the submission to <strong>Revision requested</strong> and notifies the creator in-app.
                        </>
                      }
                      note={{ label: "Feedback for creator", required: true, max: 500, placeholder: "Be specific: what should change?" }}
                      confirmLabel="Send revision request"
                      onConfirm={(note) => review("request-revision", note, "Revision requested")}
                    />
                    <ActionDialog
                      trigger={
                        <Button variant="paid">
                          <CheckCircle2 /> Approve deliverable
                        </Button>
                      }
                      icon={<CheckCircle2 />}
                      tone="paid"
                      title="Approve this deliverable?"
                      description="Records who approved it and when, against the accepted terms."
                      note={{ label: "Note (optional)" }}
                      confirmLabel="Approve"
                      onConfirm={(note) => review("approve", note, "Deliverable approved")}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
