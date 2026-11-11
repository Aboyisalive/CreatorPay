"use client";

import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { BadgeCheck, CircleDollarSign, Flag, FlaskConical, Loader2, MoreHorizontal, Plus, Radar, Search, ShieldCheck, ShieldX, Workflow } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, post, useApiData, useMutation } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import { EVENT_TYPES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { EventRow } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { campaignKeys, useCampaign } from "@/components/campaign/use-campaign";
import { ActionDialog } from "@/components/cp/action-dialog";
import { EmptyState, ErrorState, LoadingRows, StatCard } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE = 25;
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

type Analytics = {
  events: { total: number; byVerification: Record<string, number>; byEligibility: Record<string, number> };
};

export default function EventsTab() {
  const can = useCan();
  const run = useMutation();
  const { id, data: campaign } = useCampaign();
  const [type, setType] = useState("ALL");
  const [eligibility, setEligibility] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const params = new URLSearchParams({ take: String(PAGE), skip: String(page * PAGE) });
  if (type !== "ALL") params.set("eventType", type);
  if (eligibility !== "ALL") params.set("eligibilityStatus", eligibility);
  const { data, error, mutate } = useApiData<{ events: EventRow[]; total: number }>(`/api/v1/campaigns/${id}/events?${params}`);
  const analytics = useApiData<Analytics>(`/api/v1/campaigns/${id}/analytics`);
  const a = analytics.data?.events;

  const rows = (data?.events ?? []).filter(
    (event) => !query.trim() || `${event.externalEventId} ${event.creatorName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;
  const act = (eventId: string, action: string, note: string, success: string) =>
    run(() => post(`/api/v1/events/${eventId}/${action}`, { reviewNote: note || null }), { success, revalidate: campaignKeys(id) });

  return (
    <div className="space-y-6">
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label="Ingested events" icon={<Radar />} value={<AnimatedNumber value={a?.total ?? 0} className="num" />} hint="Live events, tests excluded" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Verified authentic"
            icon={<BadgeCheck />}
            value={<AnimatedNumber value={a?.byVerification.VERIFIED ?? 0} className="num text-paid" />}
            hint={a?.total ? <span className="num">{(((a.byVerification.VERIFIED ?? 0) / a.total) * 100).toFixed(1)}% of ingested</span> : "Column A: is it real?"}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard tone="brand" label="Eligible for reward" icon={<CircleDollarSign />} value={<AnimatedNumber value={a?.byEligibility.ELIGIBLE ?? 0} className="num" />} hint="Column B: does it earn?" />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            tone="breach"
            label="Ineligible / flagged"
            icon={<Flag />}
            value={<AnimatedNumber value={(a?.byEligibility.INELIGIBLE ?? 0) + (a?.byEligibility.UNDER_REVIEW ?? 0)} className="num text-breach" />}
            hint="Outside window, unattributed or rejected"
          />
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search event ID or creator…" className="h-9 pl-9" />
        </div>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(0); }}>
          <SelectTrigger className="h-9 w-full lg:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All event types</SelectItem>
            {EVENT_TYPES.map((value) => (
              <SelectItem key={value} value={value}>{title(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eligibility} onValueChange={(value) => { setEligibility(value); setPage(0); }}>
          <SelectTrigger className="h-9 w-full lg:w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All eligibility states</SelectItem>
            {["PENDING", "ELIGIBLE", "INELIGIBLE", "UNDER_REVIEW"].map((value) => (
              <SelectItem key={value} value={value}>{title(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can.manage && campaign && <RecordEventSheet campaignId={id} participants={campaign.participants} />}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-2 border-b bg-muted/30 px-5 py-3 text-sm md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2">
            <Workflow className="size-4 text-muted-foreground" />
            <span>
              <strong>Two-axis review:</strong> verification asks whether the event is real; eligibility asks whether it earns under the accepted terms.
            </span>
          </p>
          <div className="flex gap-4">
            <span className="eyebrow flex items-center gap-1.5 text-paid"><span className="size-1.5 rounded-full bg-paid" /> A · Real?</span>
            <span className="eyebrow flex items-center gap-1.5 text-escrow"><span className="size-1.5 rounded-full bg-escrow" /> B · Earns?</span>
          </div>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} className="m-5" />
        ) : !data ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Radar />} title="No events yet" description="Events arrive from your integration, CSV import or manual entry." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="eyebrow pl-5">Event &amp; time (WAT)</TableHead>
                  <TableHead className="eyebrow">Event ID</TableHead>
                  <TableHead className="eyebrow text-right">Value</TableHead>
                  <TableHead className="eyebrow">Creator &amp; attribution</TableHead>
                  <TableHead className="eyebrow">A · Verification</TableHead>
                  <TableHead className="eyebrow">B · Eligibility</TableHead>
                  <TableHead className="w-10 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((event, index) => (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: index * 0.02 } }}
                    className={cn("border-b transition-colors hover:bg-muted/40", event.isTest && "bg-hatch text-muted-foreground")}
                  >
                    <TableCell className="py-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-muted/50">
                          {event.isTest ? <FlaskConical className="size-4" /> : <Radar className="size-4" />}
                        </span>
                        <div>
                          <p className={cn("font-medium", event.isTest && "line-through")}>{title(event.eventType)}</p>
                          <p className="num text-xs text-muted-foreground">{formatStamp(event.occurredAt)}</p>
                        </div>
                        {event.isTest && <Tag>Test</Tag>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Tag className="max-w-[140px] truncate">{event.externalEventId}</Tag>
                      <p className="eyebrow mt-1 text-[9.5px] text-muted-foreground">{title(event.source)}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      {event.valueMinor ? <Money minor={event.valueMinor} className={cn("font-medium", event.eligibilityStatus === "INELIGIBLE" && "line-through opacity-60")} /> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="font-medium">{event.creatorName ?? <span className="text-muted-foreground italic">Unattributed</span>}</p>
                      {event.reviewReason && (
                        <p className={cn("text-xs", event.eligibilityStatus === "INELIGIBLE" ? "text-breach" : "text-muted-foreground")}>{event.reviewReason}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.isTest ? undefined : event.verificationStatus} truth={event.isTest ? "neutral" : undefined} label={event.isTest ? "Test" : undefined} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.eligibilityStatus} />
                    </TableCell>
                    <TableCell className="pr-5">
                      {can.review && !event.isTest && (
                        <EventActions event={event} canManage={can.manage} onAct={act} />
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > PAGE && (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Page <span className="num">{page + 1}</span> of <span className="num">{pages}</span> · {data.total.toLocaleString()} events
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventActions({
  event,
  canManage,
  onAct,
}: {
  event: EventRow;
  canManage: boolean;
  onAct: (id: string, action: string, note: string, success: string) => Promise<unknown>;
}) {
  const [dialog, setDialog] = useState<"verify" | "eligible" | "reject" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Event actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={event.verificationStatus === "VERIFIED"} onSelect={() => setDialog("verify")}>
            <ShieldCheck /> Verify (A)
          </DropdownMenuItem>
          {canManage && (
            <DropdownMenuItem disabled={event.eligibilityStatus === "ELIGIBLE"} onSelect={() => setDialog("eligible")}>
              <CircleDollarSign /> Mark eligible (B)
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" disabled={event.verificationStatus === "REJECTED"} onSelect={() => setDialog("reject")}>
            <ShieldX /> Reject
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ActionDialog
        open={dialog === "verify"}
        onOpenChange={(open) => !open && setDialog(null)}
        icon={<ShieldCheck />}
        tone="paid"
        title="Verify this event?"
        description="Confirms the event is real. Eligibility is decided separately."
        note={{ label: "Evidence note (optional)" }}
        confirmLabel="Verify"
        onConfirm={(note) => onAct(event.id, "verify", note, "Event verified")}
      />
      <ActionDialog
        open={dialog === "eligible"}
        onOpenChange={(open) => !open && setDialog(null)}
        icon={<CircleDollarSign />}
        title="Mark as eligible for reward?"
        description="It will count in the next reward calculation for the attributed creator."
        note={{ label: "Reason (recorded in audit trail)" }}
        confirmLabel="Mark eligible"
        onConfirm={(note) => onAct(event.id, "mark-eligible", note, "Event marked eligible")}
      />
      <ActionDialog
        open={dialog === "reject"}
        onOpenChange={(open) => !open && setDialog(null)}
        icon={<ShieldX />}
        tone="destructive"
        title="Reject this event?"
        description="Rejected events never enter reward calculations."
        note={{ label: "Reason", required: true }}
        confirmLabel="Reject event"
        onConfirm={(note) => onAct(event.id, "reject", note, "Event rejected")}
      />
    </>
  );
}

function RecordEventSheet({
  campaignId,
  participants,
}: {
  campaignId: string;
  participants: { id: string; creator: { displayName: string }; link: { token: string; active: boolean } | null }[];
}) {
  const run = useMutation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const linked = participants.filter((p) => p.link?.active);
  const [form, setForm] = useState({
    externalEventId: "",
    eventType: "REGISTRATION",
    occurredAt: "",
    valueNaira: "",
    token: "",
    source: "MANUAL",
    isTest: false,
  });
  const set = (patch: Partial<typeof form>) => setForm((value) => ({ ...value, ...patch }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await run(
        () =>
          post<{ duplicate?: boolean }>(`/api/v1/campaigns/${campaignId}/events`, {
            externalEventId: form.externalEventId.trim() || `MAN-${Date.now()}`,
            eventType: form.eventType,
            occurredAt: new Date(form.occurredAt || Date.now()).toISOString(),
            valueNaira: form.valueNaira.trim() || null,
            trackingToken: form.token || null,
            source: form.source,
            isTest: form.isTest,
          }),
        {
          success: (r) => (r.duplicate ? "Duplicate — the original event was kept" : "Event recorded"),
          revalidate: campaignKeys(campaignId),
        },
      );
      if (result) setOpen(false);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="lg:ml-auto">
          <Plus /> Record event manually
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">Record a conversion event</SheetTitle>
            <SheetDescription>Manual entries are labelled as such and go through the same attribution and review rules.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select value={form.eventType} onValueChange={(value) => set({ eventType: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Attributed creator link</Label>
              <Select value={form.token || "NONE"} onValueChange={(value) => set({ token: value === "NONE" ? "" : value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unattributed (needs review)</SelectItem>
                  {linked.map((p) => <SelectItem key={p.id} value={p.link!.token}>{p.creator.displayName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>External event ID</Label>
              <Input className="num" value={form.externalEventId} onChange={(e) => set({ externalEventId: e.target.value })} placeholder="Order or signup ID (deduplicates)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Occurred at</Label>
                <Input type="datetime-local" className="num" value={form.occurredAt} onChange={(e) => set({ occurredAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Value (₦)</Label>
                <Input inputMode="decimal" className="num" value={form.valueNaira} onChange={(e) => set({ valueNaira: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(value) => set({ source: value })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MANUAL", "IMPORT", "PROMO_CODE", "API"].map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Label className="flex items-start gap-3 rounded-md border p-3 font-normal">
              <Checkbox checked={form.isTest} onCheckedChange={(checked) => set({ isTest: checked === true })} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Test event</span>
                <span className="block text-xs text-muted-foreground">Labelled TEST and always excluded from rewards.</span>
              </span>
            </Label>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Record event
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
