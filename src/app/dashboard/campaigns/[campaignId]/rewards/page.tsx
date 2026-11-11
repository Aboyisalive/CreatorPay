"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Banknote,
  Calculator,
  ChevronDown,
  CircleAlert,
  Download,
  FileSignature,
  Landmark,
  Loader2,
  Receipt,
  RefreshCw,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage, post, useApiData, useMutation } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Payout, RewardDetail, RewardRow } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { RailBadge, usePaidLabel } from "@/components/rail";
import { campaignKeys, useCampaign } from "@/components/campaign/use-campaign";
import { ActionDialog } from "@/components/cp/action-dialog";
import { EmptyState, ErrorState, initials, LoadingRows, StatCard } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const FILTERS = [
  { key: "ALL", label: "All creators", match: () => true },
  { key: "REVIEW", label: "Awaiting approval", match: (s: string) => s === "CALCULATED" || s === "PENDING_REVIEW" },
  { key: "APPROVED", label: "Approved", match: (s: string) => s === "APPROVED" },
  { key: "PAYABLE", label: "Payable", match: (s: string) => s === "PAYABLE" || s === "PAYMENT_INITIATED" },
  { key: "PAID", label: "Paid", match: (s: string) => s === "PAID" },
  { key: "FLAGGED", label: "Flagged", match: (s: string) => s === "DISPUTED" || s === "PAYMENT_FAILED" },
];

export default function RewardsTab() {
  const can = useCan();
  const run = useMutation();
  const { id, data: campaign } = useCampaign();
  const key = `/api/v1/campaigns/${id}/rewards`;
  const { data, error, mutate } = useApiData<{ rewards: RewardRow[] }>(key);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const paidLabel = usePaidLabel();

  const rewards = useMemo(() => data?.rewards ?? [], [data]);
  const totals = useMemo(() => {
    const sum = (pred: (s: string) => boolean) =>
      rewards.filter((r) => pred(r.status)).reduce((acc, r) => acc + BigInt(r.totalMinor), BigInt(0)).toString();
    return {
      review: sum(FILTERS[1]!.match),
      payable: sum((s) => s === "APPROVED" || s === "PAYABLE"),
      paid: sum((s) => s === "PAID"),
      payableCount: rewards.filter((r) => r.status === "PAYABLE").length,
    };
  }, [rewards]);
  const rows = rewards.filter((reward) => FILTERS.find((f) => f.key === filter)!.match(reward.status));
  const revalidate = [...campaignKeys(id), "/api/v1/rewards", "/api/v1/payments"];

  const calculate = async () => {
    setCalculating(true);
    await run(() => post(`/api/v1/campaigns/${id}/rewards/calculate`), {
      success: "Rewards recalculated from verified, eligible events",
      revalidate,
    });
    setCalculating(false);
  };

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />;
  if (!data || !campaign) return <LoadingRows rows={5} />;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {can.finance && totals.payableCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3 rounded-lg border border-brand/60 bg-brand-tint p-4 sm:flex-row sm:items-center"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand text-on-brand">
              <Banknote className="size-5" />
            </span>
            <div className="flex-1 text-sm">
              <p className="font-medium">
                {totals.payableCount} reward{totals.payableCount === 1 ? " is" : "s are"} payable
              </p>
              <p className="text-muted-foreground">Initiate bank payouts per creator below. A payout only shows as Paid once the bank confirms it.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem>
          <StatCard label="Reward budget" icon={<Landmark />} value={<Money minor={campaign.campaign.budgetMinor} animate />} hint={<StatusBadge status={campaign.campaign.fundingStatus} dot={false} className="h-5 text-[9.5px]" />} />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Awaiting approval" icon={<Scale />} value={<Money minor={totals.review} animate />} hint="Calculated, not approved" />
        </StaggerItem>
        <StaggerItem>
          <StatCard tone="escrow" label="Approved & payable" value={<Money minor={totals.payable} animate className="text-escrow" />} hint="Committed, not moved" />
        </StaggerItem>
        <StaggerItem>
          <StatCard tone="paid" label="Paid" value={<Money minor={totals.paid} animate />} hint={paidLabel} />
        </StaggerItem>
      </Stagger>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 lg:flex-row lg:items-center">
        <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1">
          {FILTERS.map((item) => {
            const count = rewards.filter((r) => item.match(r.status)).length;
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn("relative rounded-sm px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {active && <motion.span layoutId="reward-filter" className="absolute inset-0 rounded-sm bg-card shadow-sm" />}
                <span className="relative">
                  {item.label} <span className="num">({count})</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <Button variant="outline" asChild>
            <a href={`/api/v1/campaigns/${id}/rewards.csv`}>
              <Download /> Ledger CSV
            </a>
          </Button>
          {can.manage && (
            <Button onClick={calculate} disabled={calculating}>
              {calculating ? <Loader2 className="animate-spin" /> : <Calculator />} Calculate rewards
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Audit ledger</h2>
            <p className="text-sm text-muted-foreground">Latest calculation per creator. Every recalculation is a new version; rows are never deleted.</p>
          </div>
        </div>
        {rewards.length === 0 ? (
          <EmptyState
            icon={<Calculator />}
            title="No rewards calculated yet"
            description="Run a calculation once events are verified and eligible. Totals follow the accepted terms version."
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Scale />} title="No rewards in this state" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-tint/60">
                <tr className="border-b text-left">
                  <th className="eyebrow h-10 pl-5 font-semibold">Creator</th>
                  <th className="eyebrow h-10 font-semibold">Terms</th>
                  <th className="eyebrow h-10 text-right font-semibold">Lines</th>
                  <th className="eyebrow h-10 text-right font-semibold">Total earned</th>
                  <th className="eyebrow h-10 pl-6 font-semibold">Status</th>
                  <th className="eyebrow h-10 pr-5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((reward) => {
                  const open = expanded === reward.id;
                  return (
                    <Fragment key={reward.id}>
                      <tr className={cn("border-b transition-colors hover:bg-muted/30", open && "bg-muted/30")}>
                        <td className="py-3.5 pl-5">
                          <button type="button" onClick={() => setExpanded(open ? null : reward.id)} className="flex items-center gap-3 text-left">
                            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                            <Avatar className="size-8">
                              <AvatarFallback className="bg-brand-tint text-xs font-semibold text-brand-deep">{initials(reward.creatorName)}</AvatarFallback>
                            </Avatar>
                            <span>
                              <span className="block font-medium">{reward.creatorName}</span>
                              <span className="num block text-xs text-muted-foreground">calc v{reward.version} · {formatStamp(reward.calculatedAt)}</span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <Tag>v{reward.termVersion}</Tag>
                        </td>
                        <td className="num text-right text-muted-foreground">{reward.lines.length}</td>
                        <td className="text-right">
                          <Money minor={reward.totalMinor} currency={reward.currency} className="text-base font-semibold" />
                        </td>
                        <td className="pl-6">
                          <StatusBadge status={reward.status} />
                        </td>
                        <td className="pr-5 text-right">
                          <RewardAction reward={reward} canFinance={can.finance} revalidate={revalidate} onOpen={() => setDetailId(reward.id)} />
                        </td>
                      </tr>
                      <AnimatePresence>
                        {open && (
                          <tr className="border-b bg-muted/20">
                            <td colSpan={6} className="p-0">
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <FormulaLines reward={reward} />
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RewardSheet rewardId={detailId} onClose={() => setDetailId(null)} canFinance={can.finance} revalidate={revalidate} />
    </div>
  );
}

function FormulaLines({ reward }: { reward: Pick<RewardRow, "lines" | "totalMinor" | "currency"> }) {
  if (!reward.lines.length) return <p className="px-5 py-4 text-sm text-muted-foreground">No eligible events in this calculation.</p>;
  const grouped = new Map<string, { description: string; qty: number; unit: string; amount: bigint }>();
  for (const line of reward.lines) {
    const key = `${line.description}|${line.unitAmountMinor}`;
    const entry = grouped.get(key) ?? { description: line.description, qty: 0, unit: line.unitAmountMinor, amount: BigInt(0) };
    entry.qty += line.quantity;
    entry.amount += BigInt(line.amountMinor);
    grouped.set(key, entry);
  }
  return (
    <div className="space-y-2 px-5 py-4 sm:pl-16">
      <p className="eyebrow text-muted-foreground">Formula</p>
      {[...grouped.values()].map((line) => (
        <div key={line.description + line.unit} className="num flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs">
          <span>
            {line.description}: {line.qty} × <Money minor={line.unit} currency={reward.currency} />
          </span>
          <span className="font-semibold">
            = <Money minor={line.amount.toString()} currency={reward.currency} />
          </span>
        </div>
      ))}
    </div>
  );
}

function RewardAction({
  reward,
  canFinance,
  revalidate,
  onOpen,
}: {
  reward: RewardRow;
  canFinance: boolean;
  revalidate: string[];
  onOpen: () => void;
}) {
  const run = useMutation();
  if (!canFinance) {
    return (
      <Button variant="ghost" size="sm" onClick={onOpen}>
        View
      </Button>
    );
  }
  if (reward.status === "CALCULATED" || reward.status === "PENDING_REVIEW") {
    return (
      <ActionDialog
        trigger={<Button size="sm">Approve</Button>}
        icon={<FileSignature />}
        title={`Approve ${reward.creatorName}'s reward?`}
        description="Approval records finance sign-off. No money moves yet."
        confirmLabel="Approve reward"
        onConfirm={() => run(() => post(`/api/v1/rewards/${reward.id}/approve`), { success: "Reward approved", revalidate })}
      >
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <Money minor={reward.totalMinor} className="text-lg font-semibold" />
        </div>
      </ActionDialog>
    );
  }
  if (reward.status === "APPROVED") {
    return (
      <ActionDialog
        trigger={<Button size="sm" variant="outline">Mark payable</Button>}
        icon={<Banknote />}
        title="Mark this reward payable?"
        description="Confirms funding and settlement conditions are met. Still no money moves until you initiate a payout."
        confirmLabel="Mark payable"
        onConfirm={() => run(() => post<{ message?: string }>(`/api/v1/rewards/${reward.id}/settle`), { success: (r) => r.message ?? "Marked payable", revalidate })}
      />
    );
  }
  return (
    <Button variant={["PAYABLE", "PAYMENT_FAILED"].includes(reward.status) ? "paid" : "ghost"} size="sm" onClick={onOpen}>
      {["PAYABLE", "PAYMENT_FAILED"].includes(reward.status) ? "Pay out" : "View"}
    </Button>
  );
}

function RewardSheet({
  rewardId,
  onClose,
  canFinance,
  revalidate,
}: {
  rewardId: string | null;
  onClose: () => void;
  canFinance: boolean;
  revalidate: string[];
}) {
  const run = useMutation();
  const detail = useApiData<{ reward: RewardDetail }>(rewardId ? `/api/v1/rewards/${rewardId}` : null);
  const payout = useApiData<{ payout: Payout | null }>(rewardId && canFinance ? `/api/v1/rewards/${rewardId}/payout` : null, {
    refreshInterval: (latest) => (latest?.payout && ["SUBMITTED", "PENDING", "UNKNOWN"].includes(latest.payout.state) ? 4000 : 0),
  });
  const reward = detail.data?.reward;
  const latest = payout.data?.payout;
  const inFlight = Boolean(latest && ["SUBMITTED", "PENDING", "UNKNOWN"].includes(latest.state));
  const latestId = latest?.id;

  // While the bank hasn't confirmed, ask it (status query) every few seconds so
  // the sheet resolves to Settled/Failed on its own.
  useEffect(() => {
    if (!inFlight || !latestId) return;
    const id = setInterval(() => {
      void post(`/api/v1/payments/payouts/${latestId}/reconcile`)
        .then(() => Promise.all([payout.mutate(), detail.mutate()]))
        .catch(() => null);
    }, 5000);
    return () => clearInterval(id);
  }, [inFlight, latestId, payout, detail]);
  const [method, setMethod] = useState("Bank transfer");
  const [reference, setReference] = useState("");
  const keys = [...revalidate, rewardId ? `/api/v1/rewards/${rewardId}` : ""];

  const initiate = () =>
    run(() => post(`/api/v1/rewards/${rewardId}/payout`), { success: "Payout submitted to the bank", revalidate: keys });

  return (
    <Sheet open={Boolean(rewardId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-xl">{reward ? reward.creator.displayName : "Reward"}</SheetTitle>
          <SheetDescription>{reward ? `${reward.campaign.name} · calc v${reward.version} · terms v${reward.termVersion.version}` : "Loading…"}</SheetDescription>
        </SheetHeader>
        {!reward ? (
          <LoadingRows rows={3} />
        ) : (
          <div className="space-y-6 p-4">
            <div className="flex items-end justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="eyebrow text-muted-foreground">Total earned</p>
                <Money minor={reward.totalMinor} currency={reward.currency} className="text-3xl font-semibold" />
              </div>
              <StatusBadge status={reward.status} />
            </div>

            {reward.disputeReason && (
              <div className="flex gap-3 rounded-md border border-breach/25 bg-breach-tint p-3 text-sm text-breach">
                <ShieldAlert className="size-4 shrink-0" />
                <p>
                  <strong>Disputed:</strong> {reward.disputeReason}
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border">
              <FormulaLines reward={reward} />
            </div>

            {reward.approvedBy && (
              <p className="text-xs text-muted-foreground">
                Approved by {reward.approvedBy.name} · {formatStamp(reward.approvedAt)}
              </p>
            )}

            {canFinance && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Bank payout</h3>
                  <RailBadge />
                </div>
                {latest ? (
                  <div className="space-y-2 rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={latest.state} />
                      <Money minor={latest.amountMinor} className="font-semibold" />
                    </div>
                    <p className="num text-xs text-muted-foreground">
                      Request {latest.requestId.slice(0, 12)}… · account ••••{latest.accountNo.slice(-4)}
                    </p>
                    {latest.bankReference && <p className="num text-xs">Bank ref: {latest.bankReference}</p>}
                    {["SUBMITTED", "PENDING", "UNKNOWN"].includes(latest.state) && (
                      <div className="flex items-center gap-2 pt-1">
                        <Loader2 className="size-3.5 animate-spin text-info" />
                        <span className="text-xs text-muted-foreground">Waiting for bank confirmation…</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() => run(() => post(`/api/v1/payments/payouts/${latest.id}/reconcile`), { success: "Status refreshed", revalidate: keys })}
                        >
                          <RefreshCw /> Check now
                        </Button>
                      </div>
                    )}
                    {latest.state === "FAILED" && reward.status === "PAYMENT_FAILED" && (
                      <Button variant="paid" size="sm" onClick={initiate}>
                        Retry payout
                      </Button>
                    )}
                  </div>
                ) : ["APPROVED", "PAYABLE"].includes(reward.status) ? (
                  <ActionDialog
                    trigger={
                      <Button variant="paid" className="w-full" size="lg">
                        <Landmark /> Initiate bank payout
                      </Button>
                    }
                    icon={<Landmark />}
                    tone="paid"
                    title="Send this payout to the creator's bank?"
                    description="Uses the creator's saved payout account. The request ID is reused on retry, so it can't double-pay."
                    confirmLabel="Initiate payout"
                    onConfirm={initiate}
                  >
                    <div className="flex items-center justify-between rounded-md border bg-paid-tint px-4 py-3 text-paid">
                      <span className="text-sm">Amount</span>
                      <Money minor={reward.totalMinor} className="text-lg font-semibold" />
                    </div>
                  </ActionDialog>
                ) : (
                  <p className="text-sm text-muted-foreground">Payouts unlock once the reward is approved and marked payable.</p>
                )}
              </section>
            )}

            <section className="space-y-3">
              <h3 className="font-semibold">Settlement history</h3>
              {reward.settlements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No settlements recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {reward.settlements.map((settlement) => (
                    <li key={settlement.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      <Receipt className="mt-0.5 size-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Money minor={settlement.amountMinor} className="font-medium" />
                          <StatusBadge truth="info" label="Recorded manually" dot={false} className="h-5 text-[9.5px]" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {settlement.method} · ref <span className="num">{settlement.reference}</span> · {settlement.recordedBy?.name} · {formatStamp(settlement.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canFinance && (reward.status === "PAYABLE" || reward.status === "APPROVED") && (
              <section className="space-y-3 rounded-lg border border-dashed p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <CircleAlert className="size-4 text-action" /> Record an off-platform settlement
                </h3>
                <p className="text-xs text-muted-foreground">For money sent outside CreatorPay. It is labelled as recorded manually, never as bank-confirmed.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Input value={method} onChange={(e) => setMethod(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reference</Label>
                    <Input className="num" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NIP-123…" />
                  </div>
                </div>
                <ActionDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={!reference.trim() || !method.trim()}>
                      Record settlement
                    </Button>
                  }
                  icon={<Receipt />}
                  tone="action"
                  title="Record manual settlement?"
                  description="This marks the reward settled on your word, with your name on the audit trail."
                  note={{ label: "Note (optional)" }}
                  confirmLabel="Record"
                  onConfirm={async (note) => {
                    try {
                      await post(`/api/v1/rewards/${rewardId}/settlements/manual`, { method, reference, note: note || null });
                      toast.success("Settlement recorded");
                      setReference("");
                      await detail.mutate();
                    } catch (caught) {
                      toast.error(errorMessage(caught));
                      return false;
                    }
                  }}
                />
              </section>
            )}

            {canFinance && !["PAID", "DISPUTED"].includes(reward.status) && (
              <ActionDialog
                trigger={
                  <Button variant="destructive" className="w-full">
                    <ShieldAlert /> Dispute reward
                  </Button>
                }
                icon={<ShieldAlert />}
                tone="destructive"
                title="Dispute this reward?"
                description="Blocks settlement until resolved. The creator is notified with your reason."
                note={{ label: "Reason", required: true }}
                confirmLabel="Dispute"
                onConfirm={(note) => run(() => post(`/api/v1/rewards/${rewardId}/dispute`, { reason: note }), { success: "Reward disputed", revalidate: keys })}
              />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

