import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Calculator,
  FileSignature,
  Landmark,
  LineChart,
  Link2,
  Lock,
  MousePointerClick,
  ScanSearch,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/cp/logo";
import { FadeIn, Stagger, StaggerItem } from "@/components/cp/motion";
import { StatusBadge, Tag } from "@/components/cp/status-badge";

const PIPELINE = [
  { title: "Define", body: "Objectives, reward rules and attribution window, locked as a terms version.", icon: FileSignature, tag: "Terms v1" },
  { title: "Manage", body: "Invite creators by email. They accept the exact terms before they get a link.", icon: Users, tag: "Invites" },
  { title: "Track", body: "Creator-specific links record eligible clicks; bots and invalid traffic are excluded.", icon: MousePointerClick, tag: "Clicks" },
  { title: "Verify", body: "Two-axis review: is the event real, and does it earn under the terms?", icon: ScanSearch, tag: "Events" },
  { title: "Calculate", body: "Rewards computed from verified, eligible events with an itemised formula.", icon: Calculator, tag: "Ledger" },
  { title: "Settle", body: "Finance approves, marks payable, then pays out to the creator's bank.", icon: Landmark, tag: "Payouts" },
  { title: "Learn", body: "Compare campaigns on consistent definitions. Export everything as CSV.", icon: LineChart, tag: "Reports" },
];

const SAMPLE = [
  { name: "Ada Okafor", handle: "@ada.creates", formula: "42 regs × ₦500", total: "₦21,000.00", status: "PAID" },
  { name: "Chidi Nnamdi", handle: "@chidi.tech", formula: "90 regs × ₦500 (cap ₦45,000)", total: "₦45,000.00", status: "PAYABLE" },
  { name: "Funke Balogun", handle: "@funkecreates", formula: "16 regs × ₦500", total: "₦8,000.00", status: "APPROVED" },
  { name: "Tobi Adeyemi", handle: "@tobi.daily", formula: "≈ 12 regs × ₦500", total: "≈₦6,000.00", status: "PENDING_REVIEW" },
];

export default function LandingPage() {
  return (
    <div className="bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#ledger" className="hover:text-foreground">Ledger</a>
            <a href="#creators" className="hover:text-foreground">For creators</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Start a campaign <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] opacity-60" />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:pt-28">
          <FadeIn>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
              <Sparkles className="size-3.5 text-brand-deep" /> Creator campaign accountability · Nigeria
            </span>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-bold tracking-[-0.045em] sm:text-7xl">
              Make creator marketing <span className="relative whitespace-nowrap">accountable.<span className="absolute inset-x-0 -bottom-1 -z-10 h-4 rounded-sm bg-brand/70 sm:h-6 dark:bg-brand/45" /></span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.16}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Know what your creators deliver, not just what they post. Agree terms, track attributable outcomes and pay creators on
              transparent, versioned rules.
            </p>
          </FadeIn>
          <FadeIn delay={0.24} className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="xl" asChild>
              <Link href="/register">
                Start a campaign <ArrowRight />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/register">I&apos;m a creator</Link>
            </Button>
          </FadeIn>
          <FadeIn delay={0.32} className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> Versioned, locked terms</span>
            <span className="flex items-center gap-1.5"><BadgeCheck className="size-3.5" /> Verified ≠ eligible ≠ paid</span>
            <span className="flex items-center gap-1.5"><Landmark className="size-3.5" /> Naira payouts to any Nigerian bank</span>
          </FadeIn>
        </div>
      </section>

      <section id="workflow" className="border-y bg-card/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-brand-deep">The workflow</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Seven steps, one shared record</h2>
            </div>
            <p className="max-w-md text-muted-foreground">No spreadsheets. Every step is a recorded state change that both the business and the creator can see.</p>
          </div>
          <Stagger inView className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {PIPELINE.map((step, index) => (
              <StaggerItem
                key={step.title}
                className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-glow"
              >
                <div className="flex items-center justify-between">
                  <span className="num rounded-sm bg-brand-tint px-1.5 text-xs font-semibold text-brand-deep">0{index + 1}</span>
                  <step.icon className="size-4 text-muted-foreground transition-colors group-hover:text-brand-deep" />
                </div>
                <p className="font-heading text-lg font-semibold">{step.title}</p>
                <p className="flex-1 text-sm text-muted-foreground">{step.body}</p>
                <span className="eyebrow border-t pt-2 text-[10px] text-muted-foreground">{step.tag}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="ledger" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Tag>Ledger integrity</Tag>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Four levels of truth. No blended balances.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Every naira is classified by how certain it is. Approved money never looks paid, and estimates are always marked.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["PENDING_REVIEW", "Calculated from events, awaiting sign-off"],
              ["APPROVED", "Finance approved, no money moved"],
              ["PAYABLE", "Ready to pay out to the bank"],
              ["PAID", "Bank-confirmed payout"],
            ].map(([status, text]) => (
              <div key={status} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <StatusBadge status={status} />
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>

          <FadeIn className="mt-6 overflow-hidden rounded-xl border bg-card shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-5 py-4">
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2 animate-pulse-dot rounded-full bg-paid text-paid" /> Sample ledger · Campus signups
              </p>
              <span className="eyebrow text-muted-foreground">Illustrative data</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="eyebrow py-3 pl-5 font-semibold text-muted-foreground">Creator</th>
                    <th className="eyebrow font-semibold text-muted-foreground">Formula</th>
                    <th className="eyebrow font-semibold text-muted-foreground">Status</th>
                    <th className="eyebrow pr-5 text-right font-semibold text-muted-foreground">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE.map((row) => (
                    <tr key={row.name} className="border-b last:border-0">
                      <td className="py-4 pl-5">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.handle}</p>
                      </td>
                      <td className="num text-xs text-muted-foreground">{row.formula}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td className={`num pr-5 text-right text-base font-semibold ${row.status === "PENDING_REVIEW" ? "italic opacity-70" : ""}`}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="creators" className="border-t bg-card/60 py-20">
        <Stagger inView className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3">
          {[
            { icon: Link2, title: "Your own tracking link", body: "Issued the moment you accept terms. Copy, share, and watch eligible clicks and outcomes in real time." },
            { icon: Calculator, title: "See the maths", body: "Every reward shows its formula: events × rate, caps applied. No hidden deductions." },
            { icon: Settings2, title: "Clear review loop", body: "Submit evidence, get specific feedback, resubmit. Rejections and disputes always include a reason." },
          ].map((item) => (
            <StaggerItem key={item.title} className="rounded-xl border bg-card p-6">
              <span className="grid size-11 place-items-center rounded-lg bg-brand text-on-brand">
                <item.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-brand py-16 text-on-brand">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Launch an accountable campaign today.</h2>
            <p className="mt-2 max-w-xl text-on-brand/75">Set terms, invite creators and track your first outcomes in minutes.</p>
          </div>
          <Button size="xl" variant="ink" asChild className="bg-on-brand text-white hover:bg-on-brand/85">
            <Link href="/register">
              Create your workspace <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} CreatorPay. Amounts in Nigerian naira (₦).</p>
        </div>
      </footer>
    </div>
  );
}
