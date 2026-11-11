"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Tone = "default" | "paid" | "action" | "destructive" | "ink";

/**
 * Confirmation dialog for consequential actions (publish, approve, payout,
 * dispute…). Optionally collects a note; `noteRequired` blocks confirm until
 * one is written, matching APIs that demand a reason.
 */
export function ActionDialog({
  trigger,
  title,
  description,
  icon,
  warning,
  children,
  confirmLabel = "Confirm",
  tone = "default",
  note,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  warning?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  tone?: Tone;
  note?: { label: string; placeholder?: string; required?: boolean; max?: number };
  onConfirm: (note: string) => Promise<unknown> | unknown;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (value: boolean) => {
    setInnerOpen(value);
    onOpenChange?.(value);
    if (!value) setText("");
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const max = note?.max ?? 2000;
  const blocked = Boolean(note?.required && !text.trim());

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await onConfirm(text.trim());
      if (result !== false) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-3 border-b bg-muted/30 px-6 py-5 text-left">
          {icon && (
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg border [&_svg]:size-5",
                tone === "destructive" && "border-breach/20 bg-breach-tint text-breach",
                tone === "action" && "border-action/20 bg-action-tint text-action",
                tone === "paid" && "border-paid/20 bg-paid-tint text-paid",
                (tone === "default" || tone === "ink") && "border-brand/40 bg-brand-tint text-brand-deep",
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-heading text-lg leading-snug tracking-tight">{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          {warning && (
            <div className="rounded-md border border-action/25 bg-action-tint px-4 py-3 text-sm text-action">
              {warning}
            </div>
          )}
          {children}
          {note && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="action-note">
                  {note.label}
                  {note.required && <span className="text-breach"> *</span>}
                </Label>
                <span className="num text-xs text-muted-foreground">
                  {text.length} / {max}
                </span>
              </div>
              <Textarea
                id="action-note"
                rows={4}
                maxLength={max}
                value={text}
                placeholder={note.placeholder}
                onChange={(event) => setText(event.target.value)}
                className="resize-none bg-background"
              />
            </div>
          )}
        </div>

        <DialogFooter className="m-0 rounded-none border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} disabled={busy || blocked}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
