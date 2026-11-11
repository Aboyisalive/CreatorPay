import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { parseNairaToMinorDecimal } from "@/lib/money-server";
import { resolveAttribution } from "@/lib/attribution";

export type IngestEventInput = {
  externalEventId: string;
  eventType:
    | "REGISTRATION"
    | "LEAD"
    | "PURCHASE"
    | "SUBSCRIPTION"
    | "APPLICATION"
    | "OTHER";
  occurredAt: string | Date;
  valueNaira?: string | null;
  trackingToken?: string | null;
  isTest: boolean;
  source: "API" | "IMPORT" | "MANUAL" | "PROMO_CODE";
};

export type IngestResult = {
  event: Prisma.ConversionEventGetPayload<Record<string, never>>;
  attribution: { method: string; reason: string | null };
  duplicate: boolean;
};

/**
 * Shared conversion-event ingestion: validates campaign state, resolves
 * attribution, applies verification/eligibility policy, and enforces
 * idempotency on (campaignId, externalEventId).
 *
 * Auth and role checks stay in the calling route; this is domain logic only.
 */
export async function ingestConversionEvent(
  campaignId: string,
  input: IngestEventInput,
): Promise<IngestResult> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      currentTermVersion: { include: { rewardRules: true } },
    },
  });
  if (!campaign) {
    throw notFound("Campaign not found.");
  }

  if (!["PUBLISHED", "CLOSED"].includes(campaign.status)) {
    throw conflict("Campaigns only accept conversion events while published or closed.");
  }

  const occurredAt =
    input.occurredAt instanceof Date ? input.occurredAt : new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw badRequest("occurredAt must be a valid timestamp.");
  }
  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw badRequest("Event timestamp cannot be in the future.");
  }

  let participantId: string | null = null;
  let trackingLinkId: string | null = null;

  if (input.trackingToken) {
    const link = await db.trackingLink.findUnique({
      where: { token: input.trackingToken },
      include: { participant: true },
    });

    if (
      !link ||
      link.campaignId !== campaign.id ||
      !link.active ||
      link.participant.status !== "ACTIVE"
    ) {
      throw badRequest(
        "Tracking token is not valid for an active participant in this campaign.",
      );
    }

    participantId = link.participantId;
    trackingLinkId = link.id;
  }

  const hasMatchingRule = Boolean(
    campaign.currentTermVersion?.rewardRules.some(
      (rule) =>
        rule.type === "PER_EVENT" && rule.eventType === input.eventType,
    ),
  );

  const attribution = await resolveAttribution({
    participantId,
    eventAt: occurredAt,
    windowDays: campaign.attributionWindowDays,
  });

  const verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" =
    input.source === "IMPORT" ? "PENDING" : "VERIFIED";
  let eligibilityStatus: "PENDING" | "ELIGIBLE" | "INELIGIBLE" | "UNDER_REVIEW" =
    "PENDING";
  let reviewReason: string | null = null;

  if (input.isTest) {
    eligibilityStatus = "INELIGIBLE";
    reviewReason = "Test event: excluded from reward calculations.";
  } else if (!participantId) {
    eligibilityStatus = "UNDER_REVIEW";
    reviewReason = attribution.reason;
  } else if (!hasMatchingRule) {
    eligibilityStatus = "INELIGIBLE";
    reviewReason = "No performance reward rule matches this event type.";
  } else if (!attribution.clickId) {
    eligibilityStatus = "INELIGIBLE";
    reviewReason = attribution.reason;
  } else {
    eligibilityStatus = "ELIGIBLE";
  }

  if (input.source === "IMPORT" && !reviewReason) {
    reviewReason = "Imported event awaiting verification.";
  }

  const data = {
    campaignId: campaign.id,
    participantId,
    trackingLinkId,
    externalEventId: input.externalEventId,
    eventType: input.eventType,
    valueMinor: input.valueNaira ? parseNairaToMinorDecimal(input.valueNaira) : null,
    currency: campaign.currency,
    occurredAt,
    source: input.source,
    verificationStatus,
    eligibilityStatus,
    reviewReason,
    isTest: input.isTest,
  };

  let event;
  try {
    event = await db.conversionEvent.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await db.conversionEvent.findUnique({
        where: {
          campaignId_externalEventId: {
            campaignId: campaign.id,
            externalEventId: input.externalEventId,
          },
        },
      });
      if (existing) {
        return {
          event: existing,
          attribution: { method: attribution.method, reason: attribution.reason },
          duplicate: true,
        };
      }
    }
    throw error;
  }

  // Durable, auditable record of the attribution decision, kept separately
  // from the event so the reason is never lost to a later recompute. `model`
  // records the campaign's attribution model that was applied; `reason`
  // explains the outcome, including why an event stayed unattributed.
  await db.attributionRecord.create({
    data: {
      conversionEventId: event.id,
      participantId,
      trackingLinkId,
      clickId: attribution.clickId,
      model: campaign.attributionModel,
      windowDays: campaign.attributionWindowDays,
      reason: attribution.reason,
    },
  });

  return {
    event,
    attribution: { method: attribution.method, reason: attribution.reason },
    duplicate: false,
  };
}
