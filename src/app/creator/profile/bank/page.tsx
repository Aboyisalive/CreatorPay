"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleHelp, Info, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { NIGERIAN_BANKS, bankName } from "@/lib/banks";
import { send, useApiData, useMutation } from "@/lib/swr";
import { cn } from "@/lib/utils";
import type { BankDetails } from "@/lib/api-types";
import { useSession } from "@/components/session";
import { CreatorHeader } from "@/components/creator-shell";
import { FadeIn } from "@/components/cp/motion";
import { StatusBadge } from "@/components/cp/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// The backend validates the account number length and check digit
// (src/lib/payments/nuban.ts); keep this in step with it.
const ACCOUNT_DIGITS = 11;

export default function BankSetupPage() {
  const { user } = useSession();
  const run = useMutation();
  const { data } = useApiData<{ bankDetails: BankDetails | null }>("/api/v1/me/bank-details");
  const current = data?.bankDetails;
  const [bankDraft, setBankCode] = useState<string | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [nameDraft, setAccountName] = useState<string | null>(null);
  const bankCode = bankDraft ?? current?.bankCode ?? "";
  const accountName = nameDraft ?? current?.accountNameConfirmed ?? user.name;
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);


  const complete = accountNo.length === ACCOUNT_DIGITS;
  const ready = bankCode && complete && accountName.trim().length > 1 && confirmed;

  const save = async () => {
    setBusy(true);
    const ok = await run(
      () => send("PUT", "/api/v1/me/bank-details", { bankCode, accountNo, accountNameConfirmed: accountName.trim() }),
      { success: "Payout account saved", revalidate: ["/api/v1/me/bank-details"] },
    );
    if (ok) {
      setAccountNo("");
      setConfirmed(false);
    }
    setBusy(false);
  };

  return (
    <>
      <CreatorHeader
        back="/creator/profile"
        title="Payout bank setup"
        subtitle="Where your campaign earnings land"
        right={
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Help">
                <CircleHelp />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="text-sm">
              Payouts go to one Nigerian bank account in your name. We check the account number format before saving; the bank confirms the
              account when the first payout is sent.
            </PopoverContent>
          </Popover>
        }
      />

      <div className="space-y-5 p-4">
        {current && (
          <FadeIn className="overflow-hidden rounded-xl border border-white/10 bg-[#17150f] p-5 text-[#f2f1ed] shadow-lift">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-md bg-brand text-on-brand">
                <Landmark className="size-5" />
              </span>
              <StatusBadge truth={current.verifiedByBank ? "paid" : "info"} label={current.verifiedByBank ? "Bank verified" : "Format checked"} dot={false} />
            </div>
            <p className="eyebrow mt-6 text-[#f2f1ed]/60">Current payout account</p>
            <p className="font-heading text-xl font-semibold">{bankName(current.bankCode)}</p>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-sm uppercase">{current.accountNameConfirmed}</span>
              <span className="num tracking-widest">•••• {current.accountNo.slice(-4)}</span>
            </div>
          </FadeIn>
        )}

        <section className="space-y-5 rounded-xl border bg-card p-4">
          <div>
            <h2 className="font-heading text-xl font-semibold">{current ? "Change bank account" : "Add bank account"}</h2>
            <p className="text-sm text-muted-foreground">Any Nigerian bank. Interbank transfer charges may apply.</p>
          </div>

          <div className="space-y-2">
            <Label>Bank</Label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select your bank" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_BANKS.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="account">Account number</Label>
              <span className={cn("num text-xs", complete ? "text-paid" : "text-muted-foreground")}>
                {accountNo.length}/{ACCOUNT_DIGITS}
              </span>
            </div>
            <div className="flex overflow-hidden rounded-md border bg-background focus-within:border-foreground focus-within:ring-2 focus-within:ring-brand">
              <span className="num grid place-items-center border-r bg-muted px-3 text-sm">NGN</span>
              <input
                id="account"
                inputMode="numeric"
                autoComplete="off"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_DIGITS))}
                className="num h-12 w-full bg-transparent px-3 text-lg tracking-[0.18em] outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Account name (as shown by your bank)</Label>
            <Input id="name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-11 uppercase" />
          </div>

          <AnimatePresence>
            {complete && bankCode && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <Label className="flex items-start gap-3 rounded-lg border border-paid/25 bg-paid-tint p-3 font-normal">
                  <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-paid">
                      <CheckCircle2 className="size-4" /> Confirm details
                    </span>
                    {bankName(bankCode)} · <span className="num">{accountNo}</span> belongs to <strong className="uppercase">{accountName}</strong>.
                  </span>
                </Label>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            We can&apos;t look up account names yet, so double-check the name. A wrong account can delay or misdirect your payout.
          </div>

          <Button size="lg" className="w-full" onClick={save} disabled={!ready || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Save payout account
          </Button>
        </section>
      </div>
    </>
  );
}
