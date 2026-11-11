"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { SWRConfig } from "swr";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { fetcher } from "@/lib/swr";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32 }}>
        <SWRConfig value={{ fetcher, revalidateOnFocus: true, keepPreviousData: true }}>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </SWRConfig>
      </MotionConfig>
    </ThemeProvider>
  );
}
