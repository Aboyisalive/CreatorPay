"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Briefcase, Check, Loader2, Sparkles } from "lucide-react";
import { mutate } from "swr";
import { errorMessage, post } from "@/lib/swr";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNext } from "../login/login-form";

const TYPES = [
  { value: "BUSINESS", label: "Business or agency", hint: "Run campaigns and pay creators", icon: Briefcase },
  { value: "CREATOR", label: "Creator", hint: "Join campaigns and get paid", icon: Sparkles },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [type, setType] = useState<"BUSINESS" | "CREATOR">(next?.startsWith("/invite") ? "CREATOR" : "BUSINESS");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(password), label: "A letter" },
    { ok: /\d/.test(password), label: "A number" },
  ];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/v1/auth/register", {
        name,
        email,
        password,
        accountType: type,
        workspaceName: type === "BUSINESS" ? workspaceName : undefined,
      });
      await mutate(() => true, undefined, { revalidate: false });
      router.push(next ?? (type === "BUSINESS" ? "/dashboard" : "/creator"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, "Could not create your account."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">Free to start. No card required.</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Account type">
        {TYPES.map((option) => {
          const active = type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(option.value)}
              className={cn("relative rounded-lg border p-3.5 text-left transition-colors", !active && "hover:bg-muted/50")}
            >
              {active && <motion.span layoutId="acct-type" className="absolute inset-0 rounded-lg border-2 border-brand bg-brand-tint" />}
              <span className="relative block space-y-1.5">
                <option.icon className="size-5 text-brand-deep" />
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        </div>
        <AnimatePresence initial={false}>
          {type === "BUSINESS" && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-2 pb-0.5">
                <Label htmlFor="workspace">Business or agency name</Label>
                <Input id="workspace" autoComplete="organization" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="h-11" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          <div className="flex flex-wrap gap-3 pt-1">
            {checks.map((check) => (
              <span key={check.label} className={cn("flex items-center gap-1 text-xs transition-colors", check.ok ? "text-paid" : "text-muted-foreground")}>
                <motion.span animate={{ scale: check.ok ? [1, 1.3, 1] : 1 }} transition={{ type: "tween", duration: 0.3 }}>
                  <Check className="size-3.5" />
                </motion.span>
                {check.label}
              </span>
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-breach/25 bg-breach-tint px-3 py-2 text-sm text-breach">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Create account <ArrowRight />
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand-deep hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
