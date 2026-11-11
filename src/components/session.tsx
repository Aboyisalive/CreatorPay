"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useApiData } from "@/lib/swr";
import { ApiClientError } from "@/lib/client-api";
import type { Role, SessionUser } from "@/lib/api-types";
import { ErrorState } from "@/components/cp/blocks";
import { LogoMark } from "@/components/cp/logo";

type SessionValue = {
  user: SessionUser;
  role: Role | null;
  workspace: SessionUser["memberships"][number]["workspace"] | null;
  refresh: () => Promise<unknown>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionGate({
  children,
  require,
}: {
  children: ReactNode;
  /** Redirect users who don't fit this surface to the right home. */
  require: "business" | "creator";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, error, mutate } = useApiData<{ user: SessionUser }>("/api/v1/me", {
    revalidateOnFocus: false,
  });

  const unauthorized = error instanceof ApiClientError && error.status === 401;
  const user = data?.user;
  const membership = user?.memberships[0] ?? null;
  const wrongSurface =
    user &&
    ((require === "business" && !membership && user.creatorProfile) ||
      (require === "creator" && !user.creatorProfile && membership));

  useEffect(() => {
    if (unauthorized) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    } else if (wrongSurface) {
      router.replace(require === "business" ? "/creator" : "/dashboard");
    }
  }, [unauthorized, wrongSurface, require, router, pathname]);

  if (error && !unauthorized) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <ErrorState message={error.message ?? "Could not load your account."} onRetry={() => mutate()} />
      </div>
    );
  }

  if (!user || unauthorized || wrongSurface) {
    return <SplashLoader />;
  }

  return (
    <SessionContext
      value={{
        user,
        role: membership?.role ?? null,
        workspace: membership?.workspace ?? null,
        refresh: () => mutate(),
      }}
    >
      {children}
    </SessionContext>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionGate");
  return value;
}

export function useCan() {
  const { role } = useSession();
  const has = (roles: string[]) => Boolean(role && roles.includes(role));
  return {
    manage: has(["OWNER", "ADMIN", "CAMPAIGN_MANAGER"]),
    review: has(["OWNER", "ADMIN", "CAMPAIGN_MANAGER", "REVIEWER"]),
    finance: has(["OWNER", "ADMIN", "FINANCE"]),
  };
}

export function SplashLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ scale: [1, 0.9, 1], opacity: [1, 0.75, 1] }}
          transition={{ type: "tween", duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoMark className="size-14" priority />
        </motion.div>
        <span className="eyebrow text-muted-foreground">Loading your ledger…</span>
      </motion.div>
    </div>
  );
}
