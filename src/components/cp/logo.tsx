import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "auto" | "onBrand";

/**
 * The CreatorPay mark. `auto` swaps the yellow + navy mark (light theme) for the
 * all-yellow mark (dark theme). `onBrand` is for yellow surfaces, where a yellow
 * mark would vanish: it sits on a dark tile instead.
 */
export function LogoMark({
  className,
  tone = "auto",
  priority = false,
}: {
  className?: string;
  tone?: Tone;
  priority?: boolean;
}) {
  if (tone === "onBrand") {
    return (
      <span className={cn("relative block size-8 shrink-0 rounded-md bg-on-brand", className)} aria-hidden>
        <span className="absolute inset-[16%]">
          <Image src="/brand/logo-dark.png" alt="" fill sizes="64px" priority={priority} className="object-contain" />
        </span>
      </span>
    );
  }
  return (
    <span className={cn("relative block size-8 shrink-0", className)} aria-hidden>
      <Image
        src="/brand/logo-light.png"
        alt=""
        width={128}
        height={128}
        priority={priority}
        className="size-full object-contain dark:hidden"
      />
      <Image
        src="/brand/logo-dark.png"
        alt=""
        width={128}
        height={128}
        priority={priority}
        className="hidden size-full object-contain dark:block"
      />
    </span>
  );
}

export function Logo({
  href = "/",
  className,
  subtitle,
  tone = "auto",
}: {
  href?: string;
  className?: string;
  subtitle?: string;
  tone?: Tone;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="CreatorPay home">
      <LogoMark tone={tone} priority className="size-9" />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[1.1rem] font-bold tracking-tight">CreatorPay</span>
        {subtitle && <span className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</span>}
      </span>
    </Link>
  );
}
