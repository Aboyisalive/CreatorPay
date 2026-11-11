import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/cp/logo";
import { FadeIn } from "@/components/cp/motion";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-brand p-10 text-on-brand lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.18] [--border:rgb(23_21_15/0.5)]" />
        <div className="relative">
          <Logo tone="onBrand" />
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="text-5xl leading-[1.02] font-bold tracking-[-0.04em]">
            Know what your creators deliver, not just what they post.
          </h1>
          <ul className="space-y-3 text-[0.95rem]">
            {[
              "Agreed terms, locked and versioned",
              "Verified, attributable outcomes",
              "Transparent reward maths and payout status",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5" /> {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="eyebrow relative text-on-brand/70">Built for creator campaigns in Nigeria · ₦ NGN</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <FadeIn className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </FadeIn>
      </main>
    </div>
  );
}
