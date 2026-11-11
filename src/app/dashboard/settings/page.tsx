"use client";

import { useState } from "react";
import { Building2, Loader2, Palette, Users } from "lucide-react";
import { send, useApiData, useMutation } from "@/lib/swr";
import { ROLE_LABELS } from "@/lib/status";
import { formatDay } from "@/lib/time";
import { useCan, useSession } from "@/components/session";
import { AppearancePicker } from "@/components/appearance-picker";
import { initials, LoadingRows, PageHeader, Panel } from "@/components/cp/blocks";
import { FadeIn } from "@/components/cp/motion";
import { Tag } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = { membershipId: string; role: string; joinedAt: string; user: { name: string; email: string } };

export default function SettingsPage() {
  const { workspace, refresh } = useSession();
  const can = useCan();
  const run = useMutation();
  const members = useApiData<{ members: Member[] }>("/api/v1/workspaces/current/members");
  const [draft, setName] = useState<string | null>(null);
  const name = draft ?? workspace?.name ?? "";
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = await run(() => send("PATCH", "/api/v1/workspaces/current", { name: name.trim() }), {
      success: "Workspace updated",
      revalidate: ["/api/v1/workspaces"],
    });
    if (ok) {
      await refresh();
      setName(null);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeader eyebrow="Settings" title="Workspace settings" description="Your organisation, team and how CreatorPay looks for you." />
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden space-y-1 text-sm lg:block">
          {[
            ["#workspace", "Workspace", Building2],
            ["#team", "Team", Users],
            ["#appearance", "Appearance", Palette],
          ].map(([href, label, Icon]) => {
            const I = Icon as typeof Building2;
            return (
              <a key={href as string} href={href as string} className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <I className="size-4" /> {label as string}
              </a>
            );
          })}
        </nav>

        <div className="space-y-6">
          <Panel title="Workspace" description="Shown to creators on invitations and campaign terms." className="scroll-mt-24" >
            <div id="workspace" className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ws-name">Business name</Label>
                  <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!can.manage} />
                </div>
                <div className="space-y-2">
                  <Label>Currency &amp; timezone</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Tag>{workspace?.currency ?? "NGN"}</Tag>
                    <Tag>Africa/Lagos (WAT)</Tag>
                  </div>
                </div>
              </div>
              {can.manage && (
                <Button onClick={save} disabled={busy || name.trim().length < 2 || name.trim() === workspace?.name}>
                  {busy && <Loader2 className="animate-spin" />} Save changes
                </Button>
              )}
            </div>
          </Panel>

          <Panel title="Team" description="People with access to this workspace and what they can do.">
            <div id="team" className="scroll-mt-24">
              {!members.data ? (
                <LoadingRows rows={3} />
              ) : (
                <ul className="divide-y">
                  {members.data.members.map((member) => (
                    <li key={member.membershipId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-brand-tint text-xs font-semibold text-brand-deep">{initials(member.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">Joined {formatDay(member.joinedAt)}</span>
                      <Tag>{ROLE_LABELS[member.role] ?? member.role}</Tag>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">Team invitations are coming soon. Ask support to add members for now.</p>
            </div>
          </Panel>

          <Panel title="Appearance" description="Saved on this device.">
            <div id="appearance" className="scroll-mt-24 p-5">
              <AppearancePicker />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
