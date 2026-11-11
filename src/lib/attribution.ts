import type { EventType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  attributionWindowStart,
  isBotUserAgent,
  isWithinAttributionWindow,
} from "@/lib/attribution-rules";

export { attributionWindowStart, isBotUserAgent, isWithinAttributionWindow };

export async function findAttributableClick(input: {
  participantId: string;
  eventAt: Date;
  windowDays: number;
}) {
  return db.clickEvent.findFirst({
    where: {
      participantId: input.participantId,
      isEligible: true,
      occurredAt: {
        lte: input.eventAt,
        gte: attributionWindowStart(input.eventAt, input.windowDays),
      },
    },
    orderBy: { occurredAt: "desc" },
  });
}

export type ResolvedAttribution = {
  clickId: string | null;
  method: "LAST_ELIGIBLE_CLICK" | "NONE";
  reason: string | null;
};

export async function resolveAttribution(input: {
  participantId: string | null;
  eventAt: Date;
  windowDays: number;
}): Promise<ResolvedAttribution> {
  if (!input.participantId) {
    return {
      clickId: null,
      method: "NONE",
      reason: "No creator tracking token was supplied, so the event is unattributed.",
    };
  }

  const click = await findAttributableClick({
    participantId: input.participantId,
    eventAt: input.eventAt,
    windowDays: input.windowDays,
  });

  if (!click) {
    return {
      clickId: null,
      method: "NONE",
      reason:
        "No eligible creator click was recorded inside the attribution window.",
    };
  }

  return {
    clickId: click.id,
    method: "LAST_ELIGIBLE_CLICK",
    reason: null,
  };
}

export function eventTypeLabel(eventType: EventType): string {
  return eventType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
