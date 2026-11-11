import { db } from "@/lib/db";
import { json, parsePagination, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const { take, skip } = parsePagination(url.searchParams);
    const campaignId = url.searchParams.get("campaignId");

    const membership = await db.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!membership) {
      return json({ events: [], total: 0, take, skip });
    }
    const context = await requireWorkspace(user, membership.workspaceId);

    const where = {
      campaign: { workspaceId: context.workspace.id },
      ...(campaignId ? { campaignId } : {}),
    };

    const [events, total] = await Promise.all([
      db.conversionEvent.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take,
        skip,
        include: {
          campaign: { select: { id: true, name: true } },
        },
      }),
      db.conversionEvent.count({ where }),
    ]);

    return json({
      events: events.map((e) => ({
        id: e.id,
        campaignId: e.campaignId,
        campaignName: e.campaign.name,
        externalEventId: e.externalEventId,
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        receivedAt: e.receivedAt,
        source: e.source,
        verificationStatus: e.verificationStatus,
        eligibilityStatus: e.eligibilityStatus,
        isTest: e.isTest,
        reviewReason: e.reviewReason,
      })),
      total,
      take,
      skip,
    });
  });
}
