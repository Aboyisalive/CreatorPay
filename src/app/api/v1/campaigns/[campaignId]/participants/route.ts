import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/participants">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const participants = await db.campaignParticipant.findMany({
      where: {
        campaignId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: {
        creatorProfile: {
          include: { user: { select: { email: true, name: true } } },
        },
        acceptedTermVersion: {
          select: { version: true, publishedAt: true },
        },
        trackingLinks: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            token: true,
            active: true,
            createdAt: true,
            disabledAt: true,
          },
        },
        _count: { select: { submissions: true } },
      },
    });

    return json({
      participants: participants.map((p) => ({
        id: p.id,
        status: p.status,
        joinedAt: p.createdAt,
        acceptedAt: p.acceptedAt,
        acceptedTermVersion: p.acceptedTermVersion
          ? { version: p.acceptedTermVersion.version }
          : null,
        creator: {
          displayName: p.creatorProfile.displayName,
          email: p.creatorProfile.user.email,
        },
        link: p.trackingLinks[0]
          ? {
              id: p.trackingLinks[0].id,
              token: p.trackingLinks[0].token,
              path: `/r/${p.trackingLinks[0].token}`,
              active: p.trackingLinks[0].active,
              createdAt: p.trackingLinks[0].createdAt,
              disabledAt: p.trackingLinks[0].disabledAt,
            }
          : null,
        submissions: p._count.submissions,
      })),
    });
  });
}
