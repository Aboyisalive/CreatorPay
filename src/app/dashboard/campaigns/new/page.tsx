"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Lock,
  MousePointerClick,
  Plus,
  Rocket,
  Scale,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { errorMessage, post, send } from "@/lib/swr";
import { DELIVERABLE_TYPES, EVENT_TYPES, EVIDENCE_TYPES } from "@/lib/status";
import type { Deliverable } from "@/lib/api-types";
import { useCan } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { EmptyState, PageHeader } from "@/components/cp/blocks";
import { DeliverablesEditor } from "@/components/deliverables-editor";
import { formatAmount } from "@/components/cp/money";
import { StatusBadge, Tag } from "@/components/cp/status-badge";
import { FadeIn } from "@/components/cp/motion";

const OBJECTIVES = ["AWARENESS", "TRAFFIC", "LEADS", "REGISTRATIONS", "PURCHASES", "OTHER"];
const STEPS = [
  { title: "Basics", hint: "Objective, link, window" },
  { title: "Reward rules", hint: "What creators earn" },
  { title: "Deliverables", hint: "What creators submit" },
  { title: "Review & publish", hint: "Lock terms v1" },
];

type Rule = { key: string; name: string; eventType: string; amountNaira: string; maxCount: string; capNaira: string };

const newRule = (): Rule => ({
  key: Math.random().toString(36).slice(2),
  name: "Per verified registration",
  eventType: "REGISTRATION",
  amountNaira: "500",
  maxCount: "",
  capNaira: "",
});

const nairaOk = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.replace(/,/g, "").trim());
const naira = (value: string) => Number(value.replace(/,/g, "")) || 0;
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

function toIso(local: string) {
  return local ? new Date(local).toISOString() : null;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const can = useCan();
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState<string[]>(["REGISTRATIONS"]);
  const [mode, setMode] = useState("INVITE_ONLY");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [budget, setBudget] = useState("");
  const [windowDays, setWindowDays] = useState(7);
  const [rules, setRules] = useState<Rule[]>([newRule()]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [serverIssues, setServerIssues] = useState<string[] | null>(null);

  const issues = useMemo(() => {
    const list: { text: string; step: number }[] = [];
    if (name.trim().length < 3) list.push({ text: "Give the campaign a name (3+ characters).", step: 0 });
    if (!objectives.length) list.push({ text: "Choose at least one objective.", step: 0 });
    try {
      const url = new URL(destinationUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      list.push({ text: "Add a valid http(s) destination URL.", step: 0 });
    }
    if (!nairaOk(budget || "x")) list.push({ text: "Set a total reward budget in naira.", step: 0 });
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) list.push({ text: "End date must be after the start date.", step: 0 });
    if (!rules.length) list.push({ text: "Add at least one reward rule.", step: 1 });
    rules.forEach((rule, index) => {
      if (rule.name.trim().length < 2 || !nairaOk(rule.amountNaira) || naira(rule.amountNaira) <= 0)
        list.push({ text: `Reward rule ${index + 1} needs a name and an amount above ₦0.`, step: 1 });
      if (rule.capNaira && !nairaOk(rule.capNaira)) list.push({ text: `Reward rule ${index + 1} has an invalid cap.`, step: 1 });
    });
    return list;
  }, [name, objectives, destinationUrl, budget, startAt, endAt, rules]);

  const stepIssues = (index: number) => issues.filter((issue) => issue.step === index);

  const payload = () => ({
    name: name.trim(),
    summary: summary.trim() || null,
    description: description.trim() || null,
    objectives,
    participationMode: mode,
    attributionWindowDays: windowDays,
    destinationUrl: destinationUrl.trim(),
    startAt: toIso(startAt),
    endAt: toIso(endAt),
    budgetNaira: budget.replace(/,/g, "").trim(),
    rewardRules: rules.map((rule) => ({
      name: rule.name.trim(),
      eventType: rule.eventType,
      amountNaira: rule.amountNaira.replace(/,/g, "").trim(),
      maxCount: rule.maxCount ? Number(rule.maxCount) : null,
      capNaira: rule.capNaira ? rule.capNaira.replace(/,/g, "").trim() : null,
    })),
  });

  /** Create the draft on first save, PATCH it afterwards. */
  const saveDraft = async () => {
    setSaving(true);
    try {
      if (campaignId) {
        await send("PATCH", `/api/v1/campaigns/${campaignId}`, payload());
        return campaignId;
      }
      const result = await post<{ campaign: { id: string } }>("/api/v1/campaigns", payload());
      setCampaignId(result.campaign.id);
      toast.success("Draft saved", { description: "Terms v1 is editable until you publish." });
      return result.campaign.id;
    } catch (caught) {
      toast.error(errorMessage(caught));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (step <= 1 && stepIssues(step).length) {
      toast.error(stepIssues(step)[0]!.text);
      return;
    }
    if (step === 1) {
      const id = await saveDraft();
      if (!id) return;
    }
    if (step === 2 && campaignId) {
      const result = await post<{ ready: boolean; issues: string[] }>(`/api/v1/campaigns/${campaignId}/validate`).catch(() => null);
      setServerIssues(result?.issues ?? null);
    }
    setStep((value) => Math.min(value + 1, 3));
  };

  const publish = async () => {
    if (!campaignId) return;
    setSaving(true);
    try {
      await send("PATCH", `/api/v1/campaigns/${campaignId}`, payload());
      await post(`/api/v1/campaigns/${campaignId}/publish`);
      toast.success("Campaign published", { description: "Terms v1 is locked. Invite creators next." });
      router.push(`/dashboard/campaigns/${campaignId}/participants`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!can.manage) {
    return (
      <EmptyState
        icon={<Lock />}
        title="You can't create campaigns"
        description="Only Owners, Admins and Campaign managers can create campaigns."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to overview</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/campaigns">Campaigns</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>New campaign</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      <FadeIn>
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              Create new campaign <StatusBadge status="DRAFT" label={`Draft · step ${step + 1}`} />
            </span>
          }
          description="Define objectives, reward rules and deliverables. Creators accept a locked version of these terms."
        />
      </FadeIn>

      <nav className="grid gap-2 rounded-lg border bg-card p-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Wizard steps">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          const reachable = index <= step || (index <= 2 && campaignId);
          const blocked = index === 3 && issues.length > 0;
          return (
            <button
              key={item.title}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && setStep(index)}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                !active && "hover:bg-muted/60",
              )}
            >
              {active && (
                <motion.span layoutId="wizard-step" className="absolute inset-0 rounded-md border bg-muted shadow-[inset_3px_0_0_var(--brand-deep)]" />
              )}
              <span
                className={cn(
                  "num relative grid size-8 shrink-0 place-items-center rounded-md border text-sm font-semibold",
                  active && "border-brand bg-brand text-on-brand",
                  done && "border-paid/30 bg-paid-tint text-paid",
                )}
              >
                {done ? <Check className="size-4" /> : `0${index + 1}`}
              </span>
              <span className="relative min-w-0">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className={cn("block truncate text-xs", blocked ? "text-breach" : "text-muted-foreground")}>
                  {blocked ? `${issues.length} fix${issues.length === 1 ? "" : "es"} needed` : item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-lg border bg-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              {step === 0 && (
                <StepFrame icon={<SlidersHorizontal />} title="Core details & attribution" index={0}>
                  <Field label="Campaign name" required hint="Shown to creators on their invitation and terms.">
                    <Input value={name} maxLength={140} onChange={(e) => setName(e.target.value)} placeholder="Campus Ambassadors 2026 — Lagos cohort" />
                  </Field>
                  <Field label="Summary" counter={`${summary.length} / 280`}>
                    <Textarea rows={3} maxLength={280} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="One or two lines creators see first." className="resize-none" />
                  </Field>
                  <Field label="Brief / description" hint="Key messages, do's and don'ts, prohibited claims.">
                    <Textarea rows={4} maxLength={10000} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                  <Field label="Objectives" required hint="Select every outcome this campaign is meant to drive.">
                    <div className="flex flex-wrap gap-2">
                      {OBJECTIVES.map((value) => {
                        const on = objectives.includes(value);
                        return (
                          <motion.button
                            key={value}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setObjectives((list) => (on ? list.filter((item) => item !== value) : [...list, value]))}
                            aria-pressed={on}
                            className={cn(
                              "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium transition-colors",
                              on ? "border-brand bg-brand-tint text-foreground shadow-[inset_0_0_0_1px_var(--brand)]" : "bg-background hover:bg-muted",
                            )}
                          >
                            {on && <Check className="size-4 text-brand-deep" />}
                            {title(value)}
                          </motion.button>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label="Participation" hint="Creators join through an emailed invitation today; applications are coming.">
                    <RadioGroup value={mode} onValueChange={setMode} className="grid gap-2 sm:grid-cols-3">
                      {[
                        ["INVITE_ONLY", "Invite only", "You choose creators"],
                        ["APPLICATION", "Applications", "Creators apply"],
                        ["BOTH", "Both", "Invite and accept applications"],
                      ].map(([value, label, hint]) => (
                        <Label
                          key={value}
                          htmlFor={`mode-${value}`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal transition-colors",
                            mode === value ? "border-brand bg-brand-tint" : "hover:bg-muted/60",
                          )}
                        >
                          <RadioGroupItem id={`mode-${value}`} value={value!} className="mt-0.5" />
                          <span>
                            <span className="block text-sm font-medium">{label}</span>
                            <span className="block text-xs text-muted-foreground">{hint}</span>
                          </span>
                        </Label>
                      ))}
                    </RadioGroup>
                  </Field>
                  <Field label="Destination URL" required hint="Where creator links send visitors. UTM tags are added automatically.">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://brand.com/signup" className="num pl-9" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!/^https?:\/\//.test(destinationUrl)}
                        onClick={() => window.open(destinationUrl, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink /> Test link
                      </Button>
                    </div>
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Starts (WAT)">
                      <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="num" />
                    </Field>
                    <Field label="Ends (WAT)">
                      <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="num" />
                    </Field>
                  </div>
                  <Field label="Total reward budget" required hint="Caps the sum of all rewards. Set 0 for no cap.">
                    <div className="flex overflow-hidden rounded-md border bg-background focus-within:border-foreground focus-within:ring-2 focus-within:ring-brand">
                      <span className="num grid place-items-center border-r bg-muted px-3 text-sm font-semibold">₦</span>
                      <input
                        inputMode="decimal"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value.replace(/[^\d.,]/g, ""))}
                        placeholder="1,500,000.00"
                        className="num h-11 w-full bg-transparent px-3 text-right text-lg font-semibold outline-none"
                      />
                    </div>
                  </Field>
                  <div className="space-y-4 rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Attribution window</p>
                        <p className="text-xs text-muted-foreground">How long after a click a conversion can still be credited.</p>
                      </div>
                      <span className="num rounded-md border bg-card px-3 py-1.5 text-sm font-semibold">
                        {windowDays} day{windowDays === 1 ? "" : "s"}
                        {windowDays === 7 && <span className="text-muted-foreground"> · standard</span>}
                      </span>
                    </div>
                    <Slider min={1} max={90} step={1} value={[windowDays]} onValueChange={([value]) => setWindowDays(value!)} />
                    <div className="flex flex-wrap gap-2">
                      {[1, 7, 30, 90].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setWindowDays(preset)}
                          className={cn("eyebrow rounded-sm border px-2 py-1 transition-colors", windowDays === preset ? "border-brand bg-brand-tint" : "bg-card hover:bg-muted")}
                        >
                          {preset} day{preset === 1 ? "" : "s"}
                        </button>
                      ))}
                    </div>
                  </div>
                </StepFrame>
              )}

              {step === 1 && (
                <StepFrame icon={<Scale />} title="Reward rules" index={1}>
                  <p className="text-sm text-muted-foreground">
                    Creators earn a fixed amount for every <strong>verified, eligible</strong> event attributed to their link. Optional limits stop a rule after a count or a naira cap.
                  </p>
                  <AnimatePresence initial={false}>
                    {rules.map((rule, index) => (
                      <motion.div
                        key={rule.key}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <Tag>Rule {index + 1}</Tag>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={rules.length === 1}
                              onClick={() => setRules((list) => list.filter((item) => item.key !== rule.key))}
                              aria-label="Remove rule"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Rule name" required>
                              <Input value={rule.name} onChange={(e) => updateRule(setRules, rule.key, { name: e.target.value })} />
                            </Field>
                            <Field label="Rewarded event" required>
                              <Select value={rule.eventType} onValueChange={(value) => updateRule(setRules, rule.key, { eventType: value })}>
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EVENT_TYPES.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      {title(value)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            <Field label="Amount per event (₦)" required>
                              <Input inputMode="decimal" className="num" value={rule.amountNaira} onChange={(e) => updateRule(setRules, rule.key, { amountNaira: e.target.value })} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Max events">
                                <Input inputMode="numeric" className="num" placeholder="∞" value={rule.maxCount} onChange={(e) => updateRule(setRules, rule.key, { maxCount: e.target.value.replace(/\D/g, "") })} />
                              </Field>
                              <Field label="Cap (₦)">
                                <Input inputMode="decimal" className="num" placeholder="None" value={rule.capNaira} onChange={(e) => updateRule(setRules, rule.key, { capNaira: e.target.value })} />
                              </Field>
                            </div>
                          </div>
                          <p className="num rounded-md bg-escrow-tint px-3 py-2 text-xs text-escrow">
                            {formatAmount(naira(rule.amountNaira))} × verified {title(rule.eventType).toLowerCase()}
                            {rule.maxCount && ` · max ${rule.maxCount}`}
                            {rule.capNaira && ` · cap ${formatAmount(naira(rule.capNaira))}`} per creator
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <Button type="button" variant="outline" onClick={() => setRules((list) => [...list, { ...newRule(), name: "", eventType: "PURCHASE" }])}>
                    <Plus /> Add reward rule
                  </Button>
                </StepFrame>
              )}

              {step === 2 && campaignId && (
                <StepFrame icon={<FileText />} title="Deliverables" index={2}>
                  <DeliverablesEditor campaignId={campaignId} deliverables={deliverables} onChange={setDeliverables} />
                </StepFrame>
              )}

              {step === 3 && (
                <StepFrame icon={<Rocket />} title="Review & publish" index={3}>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Summary label="Campaign">{name || "—"}</Summary>
                    <Summary label="Objectives">{objectives.map(title).join(", ") || "—"}</Summary>
                    <Summary label="Destination">
                      <span className="num break-all">{destinationUrl || "—"}</span>
                    </Summary>
                    <Summary label="Budget">
                      <span className="num">{budget ? formatAmount(naira(budget)) : "—"}</span>
                    </Summary>
                    <Summary label="Attribution">Last eligible click · {windowDays} days</Summary>
                    <Summary label="Deliverables">
                      {deliverables.length ? deliverables.map((d) => `${d.quantity}× ${d.name}`).join(", ") : "None — rewards are performance only"}
                    </Summary>
                  </dl>
                  {serverIssues && serverIssues.length > 0 && (
                    <div className="rounded-md border border-breach/25 bg-breach-tint p-4 text-sm text-breach">
                      <p className="font-medium">The server flagged:</p>
                      <ul className="mt-1 list-disc pl-5">
                        {serverIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-md border border-action/25 bg-action-tint p-4 text-sm text-action">
                    Publishing locks <strong>terms v1</strong>. Creators who accept are bound to this version; later changes need a new version they accept separately.
                  </div>
                </StepFrame>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => (step === 0 ? router.push("/dashboard/campaigns") : setStep(step - 1))}>
              <ArrowLeft /> {step === 0 ? "Discard" : "Back"}
            </Button>
            {step < 3 ? (
              <Button onClick={next} disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {step === 1 ? "Save draft & continue" : "Continue"} <ArrowRight />
              </Button>
            ) : (
              <Button onClick={publish} disabled={saving || issues.length > 0 || !campaignId}>
                {saving ? <Loader2 className="animate-spin" /> : <Lock />} Publish & lock terms v1
              </Button>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className={cn("rounded-lg border bg-card p-5 transition-colors", issues.length ? "border-breach/40" : "border-paid/40")}>
            <div className="flex items-center justify-between gap-2">
              <p className={cn("flex items-center gap-2 font-medium", issues.length ? "text-breach" : "text-paid")}>
                {issues.length ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                Publish readiness
              </p>
              <StatusBadge truth={issues.length ? "breach" : "paid"} label={issues.length ? "Blocking" : "Ready"} />
            </div>
            <AnimatePresence initial={false}>
              {issues.length > 0 ? (
                <motion.ul layout className="mt-4 space-y-2">
                  {issues.map((issue) => (
                    <motion.li
                      key={issue.text}
                      layout
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="flex items-start gap-2 rounded-md border bg-muted/40 p-2.5 text-sm"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-breach" />
                      <button type="button" className="text-left hover:underline" onClick={() => setStep(Math.min(issue.step, step))}>
                        {issue.text}
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              ) : (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-muted-foreground">
                  All required terms are in place.
                </motion.p>
              )}
            </AnimatePresence>
            <div className="mt-4 flex gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              <Wallet className="size-4 shrink-0" />
              Funding isn&apos;t required to publish, but rewards can&apos;t be paid until deposits are matched to this campaign.
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-heading text-lg font-semibold">Contract summary</p>
              <Tag>{campaignId ? "Draft saved" : "Unsaved"}</Tag>
            </div>
            <ul className="space-y-4 text-sm">
              <SummaryRow icon={<FileText />} title="Deliverables">
                {deliverables.length ? deliverables.map((d) => `${d.quantity}× ${DELIVERABLE_TYPES[d.type] ?? d.type}`).join(", ") : "Added in step 3"}
              </SummaryRow>
              <SummaryRow icon={<Scale />} title="Reward rules">
                {rules.map((rule) => `${formatAmount(naira(rule.amountNaira))} / ${title(rule.eventType).toLowerCase()}`).join(" + ")}
              </SummaryRow>
              <SummaryRow icon={<MousePointerClick />} title="Attribution">
                Last eligible click within {windowDays} days
              </SummaryRow>
            </ul>
          </div>
          {campaignId && (
            <Button variant="outline" className="w-full" onClick={saveDraft} disabled={saving}>
              Save draft
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function updateRule(set: React.Dispatch<React.SetStateAction<Rule[]>>, key: string, patch: Partial<Rule>) {
  set((list) => list.map((rule) => (rule.key === key ? { ...rule, ...patch } : rule)));
}

function StepFrame({ icon, title, index, children }: { icon: React.ReactNode; title: string; index: number; children: React.ReactNode }) {
  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold [&_svg]:size-5 [&_svg]:text-brand-deep">
          {icon}
          {title}
        </h2>
        <span className="eyebrow text-muted-foreground">Step {index + 1} of 4</span>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  counter,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label}
          {required && <span className="text-breach">*</span>}
        </Label>
        {counter && <span className="num text-xs text-muted-foreground">{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function SummaryRow({ icon, title: heading, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b pb-4 last:border-0 last:pb-0">
      <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div>
        <p className="font-medium">{heading}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
