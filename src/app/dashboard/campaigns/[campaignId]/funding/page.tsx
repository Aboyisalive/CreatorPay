"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, FlaskConical, Landmark, Lock, ShieldCheck, Wallet } from "lucide-react";
import { parseNairaToMinor } from "@/lib/money";
import { post, useApiData, useMutation } from "@/lib/swr";
import { formatStamp } from "@/lib/time";
import type { Deposit, FundingInstructions } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { RailBadge, useRail } from "@/components/rail";
import { campaignKeys, useCampaign } from "@/components/campaign/use-campaign";
import { ActionDialog } from "@/components/cp/action-dialog";
import { CopyButton, EmptyState, ErrorState, LoadingRows, Panel } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";

export default function FundingTab() {
  const can = useCan();
  const run = useMutation();
  const { id, data: campaign } = useCampaign();
  const allowed = can.manage || can.finance;
  const funding = useApiData<{ funding: FundingInstructions }>(allowed ? `/api/v1/campaigns/${id}/funding` : null);
  const deposits = useApiData<{ deposits: Deposit[] }>(can.finance ? "/api/v1/payments/deposits" : null);
  const [amount, setAmount] = useState("");
  const rail = useRail();

  if (!allowed) {
    return <EmptyState icon={<Lock />} title="Funding is restricted" description="Campaign managers and finance users can see funding instructions." />;
  }
  if (funding.error) return <ErrorState message={funding.error.message} onRetry={() => funding.mutate()} />;
  if (!funding.data || !campaign) return <LoadingRows rows={4} />;

  const info = funding.data.funding;
  const mine = (deposits.data?.deposits ?? []).filter((deposit) => deposit.campaignId === id);
  const received = mine.filter((d) => d.state === "MATCHED").reduce((sum, d) => sum + BigInt(d.amountMinor), BigInt(0));
  const budget = BigInt(campaign.campaign.budgetMinor);
  const coverage = budget > BigInt(0) ? Math.min(100, Number((received * BigInt(10000)) / budget) / 100) : 0;
  const sandbox = Boolean(rail?.simulated || rail?.environment === "sandbox" || /sandbox|uat/i.test(info.poolAccountDisplay));

  let amountMinor: string | null = null;
  try {
    amountMinor = amount.trim() ? parseNairaToMinor(amount).toString() : null;
  } catch {
    amountMinor = null;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 rounded-lg border border-l-4 border-l-paid bg-card p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-paid-tint text-paid">
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-1 text-sm">
          <p className="font-medium">How funding works</p>
          <p className="text-muted-foreground">
            Transfer the campaign budget to the pool account below and quote this campaign&apos;s unique funding reference in the narration. Incoming
            credits are matched by that reference and credited to this campaign&apos;s ledger. Unmatched credits wait for manual matching.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Funding health" description="Matched deposits against the reward budget" action={<StatusBadge status={info.fundingStatus} />}>
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Budget required</p>
                <Money minor={campaign.campaign.budgetMinor} className="mt-1 block text-xl font-semibold" />
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Received &amp; matched</p>
                {can.finance ? (
                  <Money minor={received.toString()} animate className="mt-1 block text-xl font-semibold text-paid" />
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Finance only</p>
                )}
              </div>
            </div>
            {can.finance && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Coverage</span>
                  <span className="num font-medium">{coverage.toFixed(1)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={{ width: 0 }}
                    animate={{ width: `${coverage}%` }}
                    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )}
            {can.finance && sandbox && (
              <div className="space-y-3 rounded-md border border-dashed p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <FlaskConical className="size-4 text-info" /> Sandbox: simulate an inbound deposit
                </p>
                <p className="text-xs text-muted-foreground">The bank sandbox can&apos;t send real credits. This posts a labelled simulated deposit through the real matching path.</p>
                <div className="flex gap-2">
                  <div className="flex flex-1 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-brand">
                    <span className="num grid place-items-center border-r bg-muted px-3 text-sm">₦</span>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="500,000" className="num w-full bg-transparent px-3 text-sm outline-none" />
                  </div>
                  <ActionDialog
                    trigger={
                      <Button variant="outline" disabled={!amountMinor}>
                        Simulate
                      </Button>
                    }
                    icon={<FlaskConical />}
                    title="Post a simulated deposit?"
                    description="Recorded as SIMULATED in the deposit journal."
                    confirmLabel="Post deposit"
                    onConfirm={async () => {
                      const ok = await run(() => post(`/api/v1/campaigns/${id}/funding/simulate`, { amountMinor }), {
                        success: "Simulated deposit posted",
                        revalidate: [...campaignKeys(id), "/api/v1/payments"],
                      });
                      if (ok) setAmount("");
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Transfer instructions" description="Share with whoever sends the funds" action={<RailBadge />}>
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-md bg-ink text-background">
                <Landmark className="size-5" />
              </span>
              <div>
                <p className="eyebrow text-muted-foreground">Pool account</p>
                <p className="num text-base font-medium">{info.poolAccountDisplay}</p>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col gap-3 rounded-lg border-2 border-brand bg-brand-tint p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="eyebrow text-brand-deep">Unique funding reference</p>
                <p className="num mt-1 text-2xl font-semibold tracking-tight">{info.fundingReference}</p>
              </div>
              <CopyButton value={info.fundingReference} label="Copy reference" variant="default" />
            </motion.div>
            <div className="flex gap-3 rounded-md border border-action/25 bg-action-tint p-3 text-sm text-action">
              <AlertTriangle className="size-4 shrink-0" />
              <p>
                You <strong>must</strong> include <span className="num font-semibold">{info.fundingReference}</span> in the transfer narration. Without it the
                credit lands in the unmatched queue.
              </p>
            </div>
            {info.expiresAt && <p className="text-xs text-muted-foreground">Instructions valid until {formatStamp(info.expiresAt)}</p>}
          </div>
        </Panel>
      </div>

      {can.finance && (
        <Panel title="Deposit journal" description="Inbound credits matched to this campaign">
          {!deposits.data ? (
            <LoadingRows rows={3} />
          ) : mine.length === 0 ? (
            <EmptyState icon={<Wallet />} title="No deposits yet" description="Matched deposits appear here as soon as the bank notifies us." />
          ) : (
            <ul className="divide-y">
              {mine.map((deposit) => (
                <li key={deposit.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <Tag>{deposit.bankReference ?? deposit.id.slice(-8).toUpperCase()}</Tag>
                  <span className="text-xs text-muted-foreground">{deposit.matchedBy ? `Matched by ${deposit.matchedBy.toLowerCase().replace(/_/g, " ")}` : "Unmatched"}</span>
                  <Money minor={deposit.amountMinor} className="ml-auto font-semibold" />
                  <StatusBadge status={deposit.state} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
