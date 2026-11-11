"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, post, send } from "@/lib/swr";
import { DELIVERABLE_TYPES, EVIDENCE_TYPES } from "@/lib/status";
import { formatDay } from "@/lib/time";
import type { Deliverable } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toIso(local: string) {
  return local ? new Date(local).toISOString() : null;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-breach">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function DeliverablesEditor({
  campaignId,
  deliverables,
  onChange,
  readOnly = false,
}: {
  campaignId: string;
  deliverables: Deliverable[];
  onChange: (list: Deliverable[]) => void;
  readOnly?: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("CONTENT_REEL");
  const [quantity, setQuantity] = useState("1");
  const [evidenceType, setEvidenceType] = useState("URL");
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (name.trim().length < 2) {
      toast.error("Name this deliverable.");
      return;
    }
    setBusy(true);
    try {
      const result = await post<{ deliverable: Deliverable }>(`/api/v1/campaigns/${campaignId}/deliverables`, {
        name: name.trim(),
        type,
        quantity: Math.max(1, Math.min(100, Number(quantity) || 1)),
        evidenceType,
        description: description.trim() || null,
        dueAt: toIso(dueAt),
      });
      onChange([...deliverables, result.deliverable]);
      setName("");
      setDescription("");
      toast.success("Deliverable added");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await send("DELETE", `/api/v1/deliverables/${id}`);
      onChange(deliverables.filter((item) => item.id !== id));
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  return (
    <div className="space-y-5">
      <AnimatePresence initial={false}>
        {deliverables.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <span className="num grid size-9 place-items-center rounded-md bg-brand-tint text-sm font-semibold text-brand-deep">{item.quantity}×</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {DELIVERABLE_TYPES[item.type]} · evidence: {EVIDENCE_TYPES[item.evidenceType]}
                {item.dueAt && ` · due ${formatDay(item.dueAt)}`}
              </p>
            </div>
            {!readOnly && (
              <Button variant="ghost" size="icon-sm" onClick={() => remove(item.id)} aria-label="Remove deliverable">
                <Trash2 />
              </Button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {!readOnly && <div className="space-y-4 rounded-lg border border-dashed p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deliverable name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch reel" />
          </Field>
          <Field label="Format">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIVERABLE_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity">
            <Input inputMode="numeric" className="num" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Evidence required">
            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVIDENCE_TYPES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due (WAT)">
            <Input type="datetime-local" className="num" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          <Field label="Requirements">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="45–60s, show the signup screen" />
          </Field>
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add deliverable
        </Button>
      </div>}
      {deliverables.length === 0 && (
        <p className="text-sm text-muted-foreground">Deliverables are optional — skip this step for performance-only campaigns.</p>
      )}
    </div>
  );
}
