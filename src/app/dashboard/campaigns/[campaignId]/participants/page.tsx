"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link2, Link2Off, Loader2, Mail, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, post, useApiData, useMutation } from "@/lib/swr";
import { formatDay, formatDistanceToNowStrict } from "@/lib/time";
import { useCan } from "@/components/session";
import { campaignKeys, useCampaign } from "@/components/campaign/use-campaign";
import { ActionDialog } from "@/components/cp/action-dialog";
import { CopyButton, EmptyState, initials, LoadingRows, Panel } from "@/components/cp/blocks";
import { Money } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Invitation = { id: string; email: string; status: string; createdAt: string; expiresAt: string | null };

export default function ParticipantsTab() {
  const can = useCan();
  const run = useMutation();
  const { id, data } = useCampaign();
  const invitations = useApiData<{ invitations: Invitation[] }>(`/api/v1/campaigns/${id}/invitations`);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ email: string; url: string; existing: boolean } | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const open = data && (data.campaign.status === "PUBLISHED" || data.campaign.status === "DRAFT");

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await post<{ inviteUrl: string; existingAccount: boolean }>(`/api/v1/campaigns/${id}/invitations`, { email });
      setLastInvite({ email, url: result.inviteUrl, existing: result.existingAccount });
      setEmail("");
      toast.success("Invitation created");
      void invitations.mutate();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <LoadingRows />;

  return (
    <div className="space-y-6">
      {can.manage && (
        <Panel title="Invite a creator" description="Creators accept the current terms version before their tracking link is issued.">
          <div className="space-y-4 p-5">
            <form onSubmit={invite} className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="creator@example.com" className="h-10 pl-9" disabled={!open} />
              </div>
              <Button type="submit" size="lg" disabled={busy || !open} className="h-10">
                {busy ? <Loader2 className="animate-spin" /> : <Send />} Send invitation
              </Button>
            </form>
            {!open && <p className="text-sm text-muted-foreground">This campaign is no longer accepting creators.</p>}
            <AnimatePresence>
              {lastInvite && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-3 rounded-md border border-paid/25 bg-paid-tint p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-paid">
                        Invitation for {lastInvite.email} {lastInvite.existing ? "(existing creator account)" : "(new to CreatorPay)"}
                      </p>
                      <p className="num truncate text-xs text-muted-foreground">{lastInvite.url}</p>
                    </div>
                    <CopyButton value={lastInvite.url} label="Copy invite link" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Panel>
      )}

      <Panel title="Participants" description={`${data.stats.activeParticipants} active of ${data.stats.participants}`}>
        {data.participants.length === 0 ? (
          <EmptyState icon={<Users />} title="No participants yet" description="Creators appear here once they accept an invitation." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="eyebrow pl-5">Creator</TableHead>
                  <TableHead className="eyebrow">Status</TableHead>
                  <TableHead className="eyebrow">Terms</TableHead>
                  <TableHead className="eyebrow">Tracking link</TableHead>
                  <TableHead className="eyebrow text-right">Clicks</TableHead>
                  <TableHead className="eyebrow text-right">Events</TableHead>
                  <TableHead className="eyebrow pr-5 text-right">Latest reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell className="py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-brand-tint text-xs font-semibold text-brand-deep">{initials(participant.creator.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{participant.creator.displayName}</p>
                          <p className="truncate text-xs text-muted-foreground">{participant.creator.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={participant.status} />
                    </TableCell>
                    <TableCell>
                      <Tag>v{participant.acceptedTermVersion ?? "—"}</Tag>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDay(participant.acceptedAt)}</p>
                    </TableCell>
                    <TableCell>
                      {participant.link?.active ? (
                        <div className="flex items-center gap-1.5">
                          <span className="num max-w-[160px] truncate rounded-sm bg-muted px-2 py-1 text-xs">{participant.link.path}</span>
                          <CopyButton iconOnly value={`${origin}${participant.link.path}`} label="Copy link" />
                          {can.manage && (
                            <ActionDialog
                              trigger={
                                <Button variant="ghost" size="icon-sm" aria-label="Disable link">
                                  <Link2Off />
                                </Button>
                              }
                              icon={<Link2Off />}
                              tone="destructive"
                              title={`Disable ${participant.creator.displayName}'s link?`}
                              description="Clicks from this link stop counting immediately. Past clicks and events are kept."
                              confirmLabel="Disable link"
                              onConfirm={() =>
                                run(() => post(`/api/v1/tracking-links/${participant.link!.id}/disable`), {
                                  success: "Link disabled",
                                  revalidate: campaignKeys(id),
                                })
                              }
                            />
                          )}
                        </div>
                      ) : participant.status === "ACTIVE" && can.manage ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            run(() => post(`/api/v1/campaigns/${id}/tracking-links`, { participantId: participant.id }), {
                              success: "New tracking link issued",
                              revalidate: campaignKeys(id),
                            })
                          }
                        >
                          <Link2 /> Issue link
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No active link</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-right">{participant.clicks.toLocaleString()}</TableCell>
                    <TableCell className="num text-right">{participant.events.toLocaleString()}</TableCell>
                    <TableCell className="pr-5 text-right">
                      {participant.latestReward ? (
                        <div className="flex flex-col items-end gap-1">
                          <Money minor={participant.latestReward.totalMinor} className="font-semibold" />
                          <StatusBadge status={participant.latestReward.status} className="h-5 text-[9.5px]" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not calculated</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel title="Invitations" description="Sent invitations and their responses.">
        {!invitations.data ? (
          <LoadingRows rows={2} />
        ) : invitations.data.invitations.length === 0 ? (
          <EmptyState icon={<Mail />} title="No invitations sent" />
        ) : (
          <ul className="divide-y">
            {invitations.data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Mail className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{invitation.email}</span>
                <span className="text-xs text-muted-foreground">Sent {formatDistanceToNowStrict(invitation.createdAt)}</span>
                <StatusBadge status={invitation.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
