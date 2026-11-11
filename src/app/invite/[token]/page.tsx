"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  Flag,
  Loader2,
  MousePointerClick,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { post, useApiData, useMutation } from "@/lib/swr";
import { formatDay } from "@/lib/time";
import type { InvitationPreview, SessionUser } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { ActionDialog } from "@/components/cp/action-dialog";
import { ErrorState, initials } from "@/components/cp/blocks";
import { LogoMark } from "@/components/cp/logo";
import { Money } from "@/components/cp/money";
import { Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { SplashLoader } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const run = useMutation();
  const preview = useApiData<InvitationPreview>(`/api/v1/invitations/${token}`, { shouldRetryOnError: false });
  const me = useApiData<{ user: SessionUser }>("/api/v1/me", { shouldRetryOnError: false, revalidateOnFocus: false });
  const [accepting, setAccepting] = useState(false);
  const [termsOpen, setTermsOpen] = useState(true);

  if (preview.error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <ErrorState message={preview.error.message || "This invitation link is invalid."} />
      </div>
    );
  }
  if (!preview.data || (me.isLoading && !me.error)) return <SplashLoader />;

  const { invitation, business, campaign } = preview.data;
  const user = me.data?.user;
  const pending = invitation.status === "PENDING";
  const wrongAccount = user && user.email.toLowerCase() !== invitation.email.toLowerCase();
  const terms = (campaign.terms ?? {}) as { attribution?: { note?: string }; policies?: Record<string, string> };
  const next = encodeURIComponent(`/invite/${token}`);

  const accept = async () => {
    setAccepting(true);
    const result = await run(() => post<{ campaignId: string }>(`/api/v1/invitations/${token}/accept`), {
      success: `Terms v${campaign.termVersion ?? 1} accepted — your tracking link is ready`,
    });
    if (result) router.push(`/creator/campaigns/${result.campaignId}`);
    else setAccepting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 pt-4 pb-44">
        <header className="mb-4 flex items-center justify-between">
          <Button variant="outline" size="icon" asChild aria-label="Home">
            <Link href={user ? "/creator" : "/"}>
              <ArrowLeft />
            </Link>
          </Button>
          <span className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs">
            <LogoMark className="size-5" /> CreatorPay invitation
          </span>
        </header>

        <Stagger className="space-y-4">
          <StaggerItem className="rounded-xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="font-heading grid size-12 shrink-0 place-items-center rounded-lg border bg-muted text-sm font-bold">{initials(business.name)}</span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{business.name} invited you to</p>
                <h1 className="text-2xl leading-tight font-semibold tracking-tight text-brand-deep">{campaign.name}</h1>
              </div>
            </div>
            {campaign.summary && <p className="mt-3 text-sm text-muted-foreground">{campaign.summary}</p>}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <StatusBadge status={invitation.status} />
              <span className="num text-xs text-muted-foreground">for {invitation.email}</span>
            </div>
          </StaggerItem>

          <StaggerItem className="space-y-4 rounded-xl border bg-card p-5">
            <div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="size-3.5" /> Campaign window
              </p>
              <p className="num mt-1 text-lg font-semibold">
                {campaign.startAt ? `${formatDay(campaign.startAt)} – ${formatDay(campaign.endAt)}` : "Open-ended"}
              </p>
            </div>
            <div className="border-t pt-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Flag className="size-3.5" /> Objectives
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {campaign.objectives.map((objective) => (
                  <span key={objective} className="eyebrow rounded-sm bg-escrow-tint px-2 py-1 text-escrow">
                    {title(objective)}
                  </span>
                ))}
              </div>
            </div>
          </StaggerItem>

          <StaggerItem className="overflow-hidden rounded-xl border-2 border-brand bg-card">
            <div className="flex items-center justify-between bg-brand px-5 py-2.5 text-on-brand">
              <span className="eyebrow flex items-center gap-2">
                <Wallet className="size-3.5" /> Compensation
              </span>
              <span className="eyebrow">Terms v{campaign.termVersion ?? 1}</span>
            </div>
            <div className="space-y-3 p-5">
              <h2 className="text-xl font-semibold">How you earn</h2>
              <ul className="divide-y rounded-lg border bg-muted/30">
                {campaign.rewardRules.map((rule) => (
                  <li key={rule.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="size-1.5 rounded-full bg-brand" />
                      Per verified {title(rule.eventType ?? "event").toLowerCase()}
                      {rule.maxCount ? <span className="text-muted-foreground">(max {rule.maxCount})</span> : null}
                    </span>
                    <Money minor={rule.amountMinor} currency={campaign.currency} className="font-semibold" />
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Rewards are calculated from verified, eligible events attributed to your link, then approved and paid by {business.name}.
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <Collapsible open={termsOpen} onOpenChange={setTermsOpen} className="rounded-xl border bg-card">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="flex items-center gap-2 font-medium">
                  <FileText className="size-4" /> Terms (version {campaign.termVersion ?? 1}) — read in full
                </span>
                <ChevronDown className={cn("size-4 transition-transform", termsOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t px-5 py-4 text-sm">
                <TermRow icon={<MousePointerClick />} heading={`${campaign.attributionWindowDays}-day attribution window`}>
                  {terms.attribution?.note ??
                    "Conversions are credited to the last eligible click on your link inside the window."}
                </TermRow>
                {terms.policies &&
                  Object.entries(terms.policies).map(([key, value]) => (
                    <TermRow
                      key={key}
                      icon={key === "corrections" ? <RotateCcw /> : key === "duplicateCounting" ? <Copy /> : key === "lateEvents" ? <Clock /> : <ShieldCheck />}
                      heading={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                    >
                      {value}
                    </TermRow>
                  ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <Tag>Ref {campaign.id.slice(-8).toUpperCase()}</Tag>
                  <span className="eyebrow text-muted-foreground">Nigeria · NGN</span>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </StaggerItem>
        </Stagger>
      </div>

      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.3 }}
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-lg space-y-2 px-4 py-4">
          {!pending ? (
            <p className="text-center text-sm text-muted-foreground">This invitation is {title(invitation.status).toLowerCase()}.</p>
          ) : !user ? (
            <>
              <Button size="xl" className="w-full" asChild>
                <Link href={`/register?next=${next}`}>
                  Create account to accept <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full" asChild>
                <Link href={`/login?next=${next}`}>I already have an account</Link>
              </Button>
            </>
          ) : wrongAccount ? (
            <p className="rounded-md border border-action/25 bg-action-tint p-3 text-center text-sm text-action">
              You&apos;re signed in as {user.email}. Log in as {invitation.email} to accept.
            </p>
          ) : (
            <>
              <Button size="xl" className="w-full" onClick={accept} disabled={accepting}>
                {accepting && <Loader2 className="animate-spin" />} Accept terms v{campaign.termVersion ?? 1} <ArrowRight />
              </Button>
              <ActionDialog
                trigger={
                  <Button size="lg" variant="outline" className="w-full">
                    Decline invitation
                  </Button>
                }
                tone="destructive"
                title="Decline this invitation?"
                description={`${business.name} will see that you declined.`}
                confirmLabel="Decline"
                onConfirm={() => run(() => post(`/api/v1/invitations/${token}/decline`), { success: "Invitation declined", revalidate: [`/api/v1/invitations/${token}`] })}
              />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TermRow({ icon, heading, children }: { icon: React.ReactNode; heading: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div>
        <p className="font-medium">{heading}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
