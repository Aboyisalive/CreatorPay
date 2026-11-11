"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNowStrict } from "@/lib/time";
import { post, useApiData, useMutation } from "@/lib/swr";
import type { Notification } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/cp/blocks";

const KEY = "/api/v1/notifications?take=20";

export function NotificationBell({ className }: { className?: string }) {
  const { data } = useApiData<{ notifications: Notification[]; unread: number }>(KEY, {
    refreshInterval: 30_000,
  });
  const run = useMutation();
  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  const markAll = async () => {
    await run(
      () =>
        Promise.all(
          items.filter((item) => !item.readAt).map((item) => post(`/api/v1/notifications/${item.id}/read`)),
        ),
      { revalidate: ["/api/v1/notifications"], success: "All caught up" },
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label={`Notifications (${unread} unread)`}>
          <Bell />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="num absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-breach px-1 text-[9px] leading-4 font-bold text-white ring-2 ring-background"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="font-medium">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread} unread</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={<Bell />} title="Nothing yet" description="Reviews, rewards and payouts will show up here." />
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() =>
                      !item.readAt &&
                      run(() => post(`/api/v1/notifications/${item.id}/read`), {
                        revalidate: ["/api/v1/notifications"],
                      })
                    }
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      !item.readAt && "bg-brand-tint/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.readAt ? "bg-border" : "bg-brand-deep",
                      )}
                    />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-sm font-medium">{item.title}</span>
                      {item.body && <span className="block text-sm text-muted-foreground">{item.body}</span>}
                      <span className="num block text-[11px] text-muted-foreground">
                        {formatDistanceToNowStrict(item.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
