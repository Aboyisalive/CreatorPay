"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import {
  Activity,
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { post, useApiData } from "@/lib/swr";
import { ROLE_LABELS } from "@/lib/status";
import type { CampaignListItem } from "@/lib/api-types";
import { useCan, useSession } from "@/components/session";
import { NotificationBell } from "@/components/notification-bell";
import { RailBadge } from "@/components/rail";
import { Logo } from "@/components/cp/logo";
import { initials } from "@/components/cp/blocks";
import { StatusBadge } from "@/components/cp/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/payments", label: "Payments", icon: ArrowLeftRight, finance: true },
  { href: "/dashboard/activity", label: "Audit trail", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const isActive = useIsActive();
  const can = useCan();
  const { workspace, role } = useSession();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-5 py-5">
        <Logo href="/dashboard" subtitle={workspace?.name} />
      </div>

      <div className="px-4 pt-5">
        {can.manage && (
          <Button asChild size="lg" className="w-full justify-center" onClick={onNavigate}>
            <Link href="/dashboard/campaigns/new">
              <Plus /> New campaign
            </Link>
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main">
        <p className="eyebrow px-3 pb-2 text-muted-foreground">Workspace</p>
        {NAV.filter((item) => !item.finance || can.finance).map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md border bg-sidebar-accent shadow-[inset_3px_0_0_var(--brand-deep)]"
                />
              )}
              <Icon className="relative size-[18px]" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t p-4">
        <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5">
          <div className="min-w-0">
            <p className="eyebrow truncate text-muted-foreground">Your role</p>
            <p className="truncate text-sm font-medium">{role ? ROLE_LABELS[role] : "—"}</p>
          </div>
          <StatusBadge status="ACTIVE" label="Active" />
        </div>
        <div className="flex justify-center">
          <RailBadge />
        </div>
        <ApiStatus />
      </div>
    </div>
  );
}

/** Live readiness check against /health/ready, with measured round-trip. */
function ApiStatus() {
  const [state, setState] = useState<{ ok: boolean; ms: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const started = performance.now();
      try {
        const response = await fetch("/health/ready", { cache: "no-store" });
        if (!cancelled) setState({ ok: response.ok, ms: Math.round(performance.now() - started) });
      } catch {
        if (!cancelled) setState({ ok: false, ms: 0 });
      }
    };
    void check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full",
            state === null ? "bg-border" : state.ok ? "animate-pulse-dot bg-paid text-paid" : "bg-breach",
          )}
        />
        {state === null ? "Checking API…" : state.ok ? "API connected" : "API unavailable"}
      </span>
      {state?.ok && <span className="num">{state.ms}ms</span>}
    </div>
  );
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { data } = useApiData<{ campaigns: CampaignListItem[] }>(open ? "/api/v1/campaigns" : null);
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Jump to a campaign or page">
      <CommandInput placeholder="Search campaigns and pages…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pages">
          {NAV.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go("/dashboard/campaigns/new")}>
            <Plus /> New campaign
          </CommandItem>
        </CommandGroup>
        {data?.campaigns.length ? (
          <CommandGroup heading="Campaigns">
            {data.campaigns.map((campaign) => (
              <CommandItem key={campaign.id} value={`${campaign.name} ${campaign.id}`} onSelect={() => go(`/dashboard/campaigns/${campaign.id}`)}>
                <Megaphone />
                <span className="flex-1 truncate">{campaign.name}</span>
                <StatusBadge status={campaign.status} dot={false} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

export function UserMenu() {
  const { user } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const logout = async () => {
    await post("/api/v1/auth/logout").catch(() => null);
    router.replace("/login");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full ring-offset-2 ring-offset-background transition hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Account menu"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-brand font-semibold text-on-brand">{initials(user.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.memberships.length > 0 && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings /> Settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun /> Appearance
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BusinessShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 border-r bg-sidebar lg:block">
        <SidebarNav />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[284px] bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition hover:border-foreground/25"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">Search campaigns…</span>
            <kbd className="num hidden rounded-sm border bg-muted px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
