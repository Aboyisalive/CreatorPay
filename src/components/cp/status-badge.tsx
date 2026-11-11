import { cn } from "@/lib/utils";
import { labelOf, truthOf, TRUTH_CLASSES, type Truth } from "@/lib/status";

/**
 * Truth badge: monospaced uppercase chip whose colour encodes the ledger
 * truth level. "Live" states get a pulsing dot.
 */
export function StatusBadge({
  status,
  label,
  truth,
  className,
  dot = true,
}: {
  status?: string | null;
  label?: string;
  truth?: Truth;
  className?: string;
  dot?: boolean;
}) {
  const level = truth ?? truthOf(status);
  return (
    <span
      className={cn(
        "eyebrow inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] whitespace-nowrap",
        TRUTH_CLASSES[level],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            level === "live" && "animate-pulse-dot",
          )}
        />
      )}
      {label ?? labelOf(status)}
    </span>
  );
}

/** Small square monospace tag for metadata (refs, versions, codes). */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "num inline-flex h-6 items-center rounded-sm border bg-muted/60 px-1.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
