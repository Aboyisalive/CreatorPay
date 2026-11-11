import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/events/[eventId]">,
) {
  return withApi(request, async () => {
    const { eventId } = await ctx.params;
    const user = await requireUser();

    const event = await db.conversionEvent.findUnique({
      where: { id: eventId },
      include: {
        campaign: { select: { id: true, name: true, workspaceId: true } },
        participant: {
          include: { creatorProfile: { select: { displayName: true } } },
        },
      },
    });
    if (!event) {
      throw notFound("Event not found.");
    }
    await requireWorkspace(user, event.campaign.workspaceId);

    const linkToken = event.trackingLinkId
      ? (
          await db.trackingLink.findUnique({
            where: { id: event.trackingLinkId },
            select: { token: true },
          })
        )?.token ?? null
      : null;

    return json({
      event: {
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
        currency: event.currency,
        campaign: event.campaign,
        creatorName: event.participant?.creatorProfile.displayName ?? null,
        linkToken,
        updatedAt: event.updatedAt,
      },
    });
  });
}
