"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Check, Copy, Inbox, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && <div className="eyebrow text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-[2.35rem]">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-[0.95rem] text-muted-foreground">{description}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[1.05rem] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-lg border bg-muted/50 text-muted-foreground [&_svg]:size-5">
        {icon ?? <Inbox />}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-breach/25 bg-breach-tint p-5 text-breach sm:flex-row sm:items-center",
        className,
      )}
    >
      <AlertTriangle className="size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Retry
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3 p-5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" style={{ opacity: 1 - index * 0.15 }} />
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "escrow" | "paid" | "brand" | "breach";
  className?: string;
}) {
  const tones = {
    default: "bg-card",
    escrow: "bg-card border-l-[3px] border-l-escrow",
    paid: "border-paid bg-paid text-white dark:text-[#06210f] [&_.stat-muted]:text-white/80 dark:[&_.stat-muted]:text-[#06210f]/75",
    brand: "bg-brand-tint border-brand/50",
    breach: "bg-card border-l-[3px] border-l-breach",
  } as const;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "group relative flex min-h-[132px] flex-col justify-between gap-3 overflow-hidden rounded-lg border p-4 transition-shadow hover:shadow-lift",
        tones[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="stat-muted text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className="stat-muted text-muted-foreground [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="text-[1.6rem] leading-none font-semibold tracking-tight">{value}</div>
      {hint && <div className="stat-muted text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  variant?: "outline" | "default" | "ink" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg" | "icon" | "icon-sm";
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked; the value is still visible to select */
    }
  };
  const icon = (
    <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </motion.span>
  );
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant={variant} size="icon-sm" onClick={onCopy} className={className} aria-label={label}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Button type="button" variant={variant} size={size} onClick={onCopy} className={className}>
      {icon}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function KeyValue({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
