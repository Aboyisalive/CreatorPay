"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Home, Megaphone, UserRound, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

const TABS = [
  { href: "/creator", label: "Home", icon: Home, exact: true },
  { href: "/creator/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/creator/earnings", label: "Earnings", icon: Wallet },
  { href: "/creator/profile", label: "Profile", icon: UserRound },
];

export function CreatorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto min-h-screen max-w-lg pb-28 sm:border-x sm:bg-canvas">{children}</div>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        aria-label="Creator navigation"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 p-2">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition-colors",
                    active ? "text-on-brand" : "text-muted-foreground",
                  )}
                >
                  {active && <motion.span layoutId="creator-tab" className="absolute inset-0 rounded-lg bg-brand" />}
                  <tab.icon className="relative size-5" />
                  <span className="relative">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Sticky mobile page header with optional back button. */
export function CreatorHeader({
  title,
  subtitle,
  back,
  right,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | boolean;
  right?: ReactNode;
  leading?: ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-xl">
      {back &&
        (typeof back === "string" ? (
          <Button variant="ghost" size="icon" asChild aria-label="Back">
            <Link href={back}>
              <ArrowLeft />
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft />
          </Button>
        ))}
      {leading}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {right ?? <NotificationBell />}
    </header>
  );
}
