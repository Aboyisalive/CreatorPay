"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { mutate } from "swr";
import { errorMessage, post } from "@/lib/swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only allow same-origin relative redirects. */
export function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await post<{ workspaces: { id: string }[] }>("/api/v1/auth/login", { email, password });
      await mutate(() => true, undefined, { revalidate: false });
      router.push(next ?? (result.workspaces.length ? "/dashboard" : "/creator"));
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, "Could not log in."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Log in to your workspace or creator account.</p>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }}
            transition={{ type: "tween", duration: 0.35 }}
            className="rounded-md border border-breach/25 bg-breach-tint px-3 py-2 text-sm text-breach"
          >
            {error}
          </motion.p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : null} Log in <ArrowRight />
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New to CreatorPay?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-brand-deep hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
