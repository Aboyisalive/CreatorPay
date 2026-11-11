"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Link2, Lock, RefreshCw } from "lucide-react";
import { bankName } from "@/lib/banks";
import { post, useApiData, useMutation } from "@/lib/swr";
import { formatDistanceToNowStrict, formatStamp } from "@/lib/time";
import type { CampaignListItem, Deposit, Payout } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { RailBadge } from "@/components/rail";
import { campaignCode } from "@/components/campaign-table";
import { ActionDialog } from "@/components/cp/action-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { FadeIn } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const KEYS = ["/api/v1/payments", "/api/v1/workspaces/current/overview", "/api/v1/campaigns"];

export default function PaymentsPage() {
  const can = useCan();
  const run = useMutation();
  const deposits = useApiData<{ deposits: Deposit[] }>(can.finance ? "/api/v1/payments/deposits" : null);
  const unmatched = useApiData<{ deposits: Deposit[] }>(can.finance ? "/api/v1/payments/deposits?state=UNMATCHED" : null);
  const payouts = useApiData<{ payouts: Payout[] }>(can.finance ? "/api/v1/payments/payouts" : null, { refreshInterval: 15_000 });
  const campaigns = useApiData<{ campaigns: CampaignListItem[] }>("/api/v1/campaigns");
  const [lastReconciled, setLastReconciled] = useState<Date | null>(null);
  const names = new Map(campaigns.data?.campaigns.map((c) => [c.id, c.name]));

  if (!can.finance) {
    return <EmptyState icon={<Lock />} title="Payments are finance-only" description="Owners, Admins and Finance users can see deposits and payouts." />;
  }

  const pendingPayouts = payouts.data?.payouts.filter((p) => ["APPROVED", "SUBMITTED", "PENDING", "UNKNOWN"].includes(p.state)).length ?? 0;
  const unmatchedList = unmatched.data?.deposits ?? [];

  const reconcile = async () => {
    const result = await run(() => post<{ resolved: number }>("/api/v1/payments/reconcile"), {
      success: (r) => `Reconciled with bank · ${r.resolved} payout${r.resolved === 1 ? "" : "s"} resolved`,
      revalidate: KEYS,
    });
    if (result) setLastReconciled(new Date());
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader
          eyebrow="Treasury"
          title="Payments operations"
          description="Inbound campaign funding and outbound creator payouts, reconciled against the bank."
          meta={<RailBadge />}
          actions={
            <div className="flex items-center gap-2 rounded-md border bg-card p-1 pl-3">
              <RefreshCw className="size-3.5 text-muted-foreground" />
              <span className="num text-xs text-muted-foreground">
                {lastReconciled ? `Reconciled ${formatDistanceToNowStrict(lastReconciled)}` : "Not reconciled this session"}
              </span>
              <Button size="sm" variant="secondary" onClick={reconcile}>
                Reconcile with bank
              </Button>
            </div>
          }
        />
      </FadeIn>

      <Tabs defaultValue="deposits" className="gap-5">
        <TabsList variant="line" className="h-11 w-full justify-start border-b">
          <TabsTrigger value="deposits" className="gap-2 px-3 data-active:after:bg-brand">
            <ArrowDownLeft /> Deposits inbound
            {unmatchedList.length > 0 && <StatusBadge truth="action" label={`${unmatchedList.length} unmatched`} dot={false} className="h-5 text-[9.5px]" />}
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2 px-3 data-active:after:bg-brand">
            <ArrowUpRight /> Creator payouts
            {pendingPayouts > 0 && <StatusBadge truth="info" label={`${pendingPayouts} pending`} dot={false} className="h-5 text-[9.5px]" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="space-y-6">
          {unmatchedList.map((deposit, index) => (
            <motion.div
              key={deposit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
              className="flex flex-col gap-3 rounded-lg border border-action/30 bg-action-tint p-4 sm:flex-row sm:items-center"
            >
              <AlertTriangle className="size-5 shrink-0 text-action" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-action">Unmatched bank credit</p>
                <p className="text-muted-foreground">
                  <Money minor={deposit.amountMinor} className="font-semibold text-foreground" /> received
                  {deposit.senderHint && <> from {deposit.senderHint}</>} without a recognised funding reference
                  {deposit.bankReference && (
                    <>
                      {" "}· ref <Tag>{deposit.bankReference}</Tag>
                    </>
                  )}
                </p>
              </div>
              <MatchDialog deposit={deposit} campaigns={campaigns.data?.campaigns ?? []} />
            </motion.div>
          ))}

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Inbound deposits</h2>
              <p className="text-sm text-muted-foreground">Credits matched to your campaigns by funding reference.</p>
            </div>
            {deposits.error ? (
              <ErrorState message={deposits.error.message} className="m-5" />
            ) : !deposits.data ? (
              <LoadingRows />
            ) : deposits.data.deposits.length === 0 ? (
              <EmptyState icon={<ArrowDownLeft />} title="No deposits yet" description="Fund a campaign from its Funding tab." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="eyebrow pl-5">Received (WAT)</TableHead>
                    <TableHead className="eyebrow">Bank reference</TableHead>
                    <TableHead className="eyebrow text-right">Amount</TableHead>
                    <TableHead className="eyebrow">Matched by</TableHead>
                    <TableHead className="eyebrow">Campaign</TableHead>
                    <TableHead className="eyebrow pr-5">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.data.deposits.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="num pl-5 text-xs">{formatStamp(deposit.createdAt)}</TableCell>
                      <TableCell>
                        <Tag>{deposit.bankReference ?? "—"}</Tag>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money minor={deposit.amountMinor} className="font-semibold" />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{deposit.matchedBy ? deposit.matchedBy.toLowerCase().replace(/_/g, " ") : "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm">
                        {deposit.campaignId ? names.get(deposit.campaignId) ?? campaignCode(deposit.campaignId) : <span className="text-muted-foreground italic">Unallocated</span>}
                      </TableCell>
                      <TableCell className="pr-5">
                        <StatusBadge status={deposit.state} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payouts">
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Creator payouts</h2>
              <p className="text-sm text-muted-foreground">Each payout keeps one request ID, so retries can never double-pay. Only Settled means the bank confirmed it.</p>
            </div>
            {payouts.error ? (
              <ErrorState message={payouts.error.message} className="m-5" />
            ) : !payouts.data ? (
              <LoadingRows />
            ) : payouts.data.payouts.length === 0 ? (
              <EmptyState icon={<ArrowUpRight />} title="No payouts yet" description="Initiate payouts from a campaign's rewards ledger." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="eyebrow pl-5">Narration</TableHead>
                    <TableHead className="eyebrow">Destination</TableHead>
                    <TableHead className="eyebrow text-right">Amount</TableHead>
                    <TableHead className="eyebrow">Initiated (WAT)</TableHead>
                    <TableHead className="eyebrow">Bank reference</TableHead>
                    <TableHead className="eyebrow pr-5">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.data.payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="max-w-[240px] truncate pl-5 text-sm">{payout.narration}</TableCell>
                      <TableCell>
                        <p className="text-sm">{bankName(payout.bankCode)}</p>
                        <p className="num text-xs text-muted-foreground">••••{payout.accountNo.slice(-4)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money minor={payout.amountMinor} className="font-semibold" />
                      </TableCell>
                      <TableCell className="num text-xs">{formatStamp(payout.createdAt)}</TableCell>
                      <TableCell>{payout.bankReference ? <Tag>{payout.bankReference}</Tag> : <span className="text-xs text-muted-foreground italic">Awaiting bank</span>}</TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={payout.state} />
                          {["SUBMITTED", "PENDING", "UNKNOWN"].includes(payout.state) && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Check status"
                              onClick={() => run(() => post(`/api/v1/payments/payouts/${payout.id}/reconcile`), { success: "Status refreshed", revalidate: KEYS })}
                            >
                              <RefreshCw />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchDialog({ deposit, campaigns }: { deposit: Deposit; campaigns: CampaignListItem[] }) {
  const run = useMutation();
  const [campaignId, setCampaignId] = useState("");
  return (
    <ActionDialog
      trigger={
        <Button variant="action">
          <Link2 /> Match manually
        </Button>
      }
      icon={<Link2 />}
      tone="action"
      title="Match deposit to a campaign"
      description="Credits the campaign's ledger and is recorded as a manual match in the audit trail."
      confirmLabel="Match deposit"
      onConfirm={async () => {
        if (!campaignId) return false;
        const ok = await run(() => post(`/api/v1/payments/deposits/${deposit.id}/match`, { campaignId }), {
          success: "Deposit matched",
          revalidate: KEYS,
        });
        return ok ? undefined : false;
      }}
    >
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
        <span className="text-sm text-muted-foreground">Amount</span>
        <Money minor={deposit.amountMinor} className="text-lg font-semibold" />
      </div>
      <div className="space-y-2">
        <Label>Campaign</Label>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a campaign…" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ActionDialog>
  );
}
