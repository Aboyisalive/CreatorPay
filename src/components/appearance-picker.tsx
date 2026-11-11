"use client";

import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun, swatch: "bg-[#faf9f5]" },
  { value: "dark", label: "Dark", icon: Moon, swatch: "bg-[#0f0e0b]" },
  { value: "system", label: "System", icon: Monitor, swatch: "bg-gradient-to-r from-[#faf9f5] from-50% to-[#0f0e0b] to-50%" },
];

export function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();

  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn("relative overflow-hidden rounded-lg border p-2 text-left transition-colors", !active && "hover:bg-muted/50")}
          >
            {active && <motion.span layoutId="theme-active" className="absolute inset-0 rounded-lg border-2 border-brand" />}
            <span className={cn("block h-16 rounded-md border", option.swatch)}>
              <span className="m-2 block h-2 w-8 rounded-full bg-[#ffc61a]" />
            </span>
            <span className="mt-2 flex items-center gap-1.5 px-1 text-sm font-medium">
              <option.icon className="size-3.5" /> {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
