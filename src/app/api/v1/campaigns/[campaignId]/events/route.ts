import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { json, parsePagination, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { createEventSchema } from "@/lib/validation";
import { ingestConversionEvent } from "@/lib/events";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/events">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const url = new URL(request.url);
    const { take, skip } = parsePagination(url.searchParams);

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const eventType = url.searchParams.get("eventType");
    const eligibilityStatus = url.searchParams.get("eligibilityStatus");

    const where: Prisma.ConversionEventWhereInput = { campaignId };
    if (
      eventType &&
      [
        "REGISTRATION",
        "LEAD",
        "PURCHASE",
        "SUBSCRIPTION",
        "APPLICATION",
        "OTHER",
      ].includes(eventType)
    ) {
      where.eventType = eventType as Prisma.ConversionEventWhereInput["eventType"];
    }
    if (
      eligibilityStatus &&
      ["PENDING", "ELIGIBLE", "INELIGIBLE", "UNDER_REVIEW"].includes(
        eligibilityStatus,
      )
    ) {
      where.eligibilityStatus =
        eligibilityStatus as Prisma.ConversionEventWhereInput["eligibilityStatus"];
    }

    const [events, total] = await Promise.all([
      db.conversionEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take,
        skip,
        include: {
          participant: { include: { creatorProfile: true } },
        },
      }),
      db.conversionEvent.count({ where }),
    ]);

    return json({
      events: events.map((event) => ({
        id: event.id,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        receivedAt: event.receivedAt,
        source: event.source,
        verificationStatus: event.verificationStatus,
        eligibilityStatus: event.eligibilityStatus,
        reviewReason: event.reviewReason,
        isTest: event.isTest,
        valueMinor: event.valueMinor,
        creatorName: event.participant?.creatorProfile.displayName ?? null,
      })),
      total,
      take,
      skip,
    });
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/events">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const input = createEventSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    const result = await ingestConversionEvent(campaign.id, {
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      occurredAt: input.occurredAt,
      valueNaira: input.valueNaira,
      trackingToken: input.trackingToken,
      isTest: input.isTest,
      source: input.source,
    });

    if (result.duplicate) {
      return json({ event: result.event, duplicate: true });
    }

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "event.received",
      entityType: "ConversionEvent",
      entityId: result.event.id,
      metadata: {
        campaignId: campaign.id,
        eventType: result.event.eventType,
        eligibilityStatus: result.event.eligibilityStatus,
        source: result.event.source,
      },
    });

    return json(
      {
        event: result.event,
        attribution: result.attribution,
      },
      201,
    );
  });
}
