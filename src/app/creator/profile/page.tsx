"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Landmark, Loader2, LogOut } from "lucide-react";
import { bankName } from "@/lib/banks";
import { post, send, useApiData, useMutation } from "@/lib/swr";
import type { BankDetails } from "@/lib/api-types";
import { useSession } from "@/components/session";
import { AppearancePicker } from "@/components/appearance-picker";
import { CreatorHeader } from "@/components/creator-shell";
import { initials } from "@/components/cp/blocks";
import { FadeIn } from "@/components/cp/motion";
import { StatusBadge } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreatorProfilePage() {
  const { user, refresh } = useSession();
  const router = useRouter();
  const run = useMutation();
  const profile = user.creatorProfile;
  const bank = useApiData<{ bankDetails: BankDetails | null }>("/api/v1/me/bank-details");
  const [draft, setDraft] = useState<{ displayName?: string; bio?: string; phone?: string }>({});
  const displayName = draft.displayName ?? profile?.displayName ?? "";
  const bio = draft.bio ?? profile?.bio ?? "";
  const phone = draft.phone ?? profile?.phone ?? "";
  const setDisplayName = (value: string) => setDraft((d) => ({ ...d, displayName: value }));
  const setBio = (value: string) => setDraft((d) => ({ ...d, bio: value }));
  const setPhone = (value: string) => setDraft((d) => ({ ...d, phone: value }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = await run(
      () => send("PATCH", "/api/v1/creators/me/profile", { displayName: displayName.trim(), bio: bio.trim() || null, phone: phone.trim() || null }),
      { success: "Profile saved" },
    );
    if (ok) {
      await refresh();
      setDraft({});
    }
    setBusy(false);
  };

  const logout = async () => {
    await post("/api/v1/auth/logout").catch(() => null);
    router.replace("/login");
  };

  const details = bank.data?.bankDetails;

  return (
    <>
      <CreatorHeader title="Profile" subtitle={user.email} />
      <div className="space-y-5 p-4">
        <FadeIn className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <Avatar className="size-14 ring-2 ring-brand">
            <AvatarFallback className="bg-brand-tint text-lg font-semibold text-brand-deep">{initials(displayName || user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-heading truncate text-xl font-semibold">{displayName || user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </FadeIn>

        <Link href="/creator/profile/bank" className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-lift">
          <span className="grid size-10 place-items-center rounded-md bg-brand text-on-brand">
            <Landmark className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Payout bank account</span>
            <span className="num block truncate text-sm text-muted-foreground">
              {details ? `${bankName(details.bankCode)} ••••${details.accountNo.slice(-4)}` : "Not set up"}
            </span>
          </span>
          {details ? <StatusBadge truth={details.verifiedByBank ? "paid" : "info"} label={details.verifiedByBank ? "Verified" : "Saved"} dot={false} /> : <StatusBadge truth="action" label="Required" dot={false} />}
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        <section className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Public details</h2>
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" inputMode="tel" className="num" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Niche, platforms, audience (self-reported)" />
            <p className="text-xs text-muted-foreground">Audience details you add are shown to businesses as self-reported.</p>
          </div>
          <Button onClick={save} disabled={busy || displayName.trim().length < 2} className="w-full" size="lg">
            {busy && <Loader2 className="animate-spin" />} Save profile
          </Button>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Appearance</h2>
          <AppearancePicker />
        </section>

        <Button variant="destructive" size="lg" className="w-full" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>
    </>
  );
}
