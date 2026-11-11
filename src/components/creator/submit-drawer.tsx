"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AtSign, ClipboardPaste, FileText, Globe, Link2, Loader2, Send } from "lucide-react";
import { post, useMutation } from "@/lib/swr";
import { daysUntil } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Deliverable } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Mode = "url" | "text" | "handle";

const MODES: { value: Mode; label: string; icon: typeof Link2 }[] = [
  { value: "url", label: "Public URL", icon: Link2 },
  { value: "text", label: "Text / file link", icon: FileText },
  { value: "handle", label: "Social handle", icon: AtSign },
];

function defaultMode(evidenceType: string | undefined): Mode {
  if (evidenceType === "SOCIAL_HANDLE") return "handle";
  if (evidenceType === "TEXT") return "text";
  return "url";
}

export function SubmitDeliverableDrawer({
  campaignId,
  campaignName,
  termVersion,
  deliverable,
  open,
  onOpenChange,
  revalidate,
}: {
  campaignId: string;
  campaignName: string;
  termVersion: number | null;
  deliverable: Deliverable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revalidate: string[];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        {deliverable && (
          <SubmitForm
            key={deliverable.id}
            campaignId={campaignId}
            campaignName={campaignName}
            termVersion={termVersion}
            deliverable={deliverable}
            onDone={() => onOpenChange(false)}
            revalidate={revalidate}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SubmitForm({
  campaignId,
  campaignName,
  termVersion,
  deliverable,
  onDone,
  revalidate,
}: {
  campaignId: string;
  campaignName: string;
  termVersion: number | null;
  deliverable: Deliverable;
  onDone: () => void;
  revalidate: string[];
}) {
  const run = useMutation();
  const [mode, setMode] = useState<Mode>(defaultMode(deliverable.evidenceType));
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const validUrl = /^https?:\/\/\S+\.\S+/.test(value.trim());
  const ready = confirmed && (mode === "url" ? validUrl : value.trim().length > 1);
  const due = daysUntil(deliverable?.dueAt);

  const paste = async () => {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text) setValue(text.trim());
  };

  const submit = async () => {
    setBusy(true);
    const body =
      mode === "url"
        ? { deliverableId: deliverable.id, evidenceUrl: value.trim(), note: note.trim() || null }
        : { deliverableId: deliverable.id, evidenceText: mode === "handle" ? `@${value.trim().replace(/^@/, "")}` : value.trim(), note: note.trim() || null };
    const result = await run(() => post(`/api/v1/campaigns/${campaignId}/submissions`, body), {
      success: "Evidence submitted for review",
      revalidate,
    });
    setBusy(false);
    if (result) onDone();
  };

  return (
    <>
        <DrawerHeader className="border-b pb-4 text-left">
          <DrawerTitle className="font-heading text-2xl leading-tight font-semibold tracking-tight">
            Submit deliverable — {deliverable?.name}
          </DrawerTitle>
          <DrawerDescription className="flex flex-wrap items-center gap-2">
            Campaign: {campaignName}
            {due !== null && (
              <span className={cn("eyebrow rounded-sm px-2 py-0.5", due < 0 ? "bg-breach-tint text-breach" : "bg-action-tint text-action")}>
                {due < 0 ? `${Math.abs(due)}d overdue` : due === 0 ? "Due today" : `Due in ${due} day${due === 1 ? "" : "s"}`}
              </span>
            )}
          </DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-4 py-5">
          {deliverable?.description && <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{deliverable.description}</p>}

          <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setMode(item.value);
                  setValue("");
                }}
                className={cn("relative flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium", mode === item.value ? "text-on-brand" : "text-muted-foreground")}
              >
                {mode === item.value && <motion.span layoutId="evidence-mode" className="absolute inset-0 rounded-md bg-brand shadow-[inset_0_-2px_0_rgb(138_90_0/0.3)]" />}
                <item.icon className="relative size-3.5" />
                <span className="relative">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">
              {mode === "url" ? "Public post URL" : mode === "handle" ? "Handle the content is posted from" : "Evidence"}
              <span className="text-breach">*</span>
            </Label>
            {mode === "text" ? (
              <Textarea id="evidence" rows={3} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste a file link or describe the evidence" />
            ) : (
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 focus-within:border-foreground focus-within:ring-2 focus-within:ring-brand">
                {mode === "url" ? <Globe className="size-4 text-muted-foreground" /> : <AtSign className="size-4 text-muted-foreground" />}
                <input
                  id="evidence"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={mode === "url" ? "https://instagram.com/reel/…" : "your_handle"}
                  className="num h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  inputMode={mode === "url" ? "url" : "text"}
                />
                <Button type="button" variant="secondary" size="sm" onClick={paste}>
                  <ClipboardPaste /> Paste
                </Button>
              </div>
            )}
            {mode === "url" && value && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn("eyebrow flex items-center gap-1.5 rounded-sm border-l-2 px-2 py-1.5", validUrl ? "border-paid bg-paid-tint text-paid" : "border-breach bg-breach-tint text-breach")}
              >
                {validUrl ? "Link format looks right" : "Enter a full https:// link"}
              </motion.p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="note">Note for the reviewer (optional)</Label>
              <span className="num text-xs text-muted-foreground">{note.length}/300</span>
            </div>
            <Textarea id="note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none" />
          </div>

          <Label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 font-normal">
            <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} className="mt-0.5" />
            <span className="text-sm">I confirm this content is live and complies with campaign terms v{termVersion ?? 1}.</span>
          </Label>
        </div>

        <DrawerFooter className="border-t">
          <Button size="xl" onClick={submit} disabled={!ready || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Submit evidence
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </DrawerFooter>
    </>
  );
}
