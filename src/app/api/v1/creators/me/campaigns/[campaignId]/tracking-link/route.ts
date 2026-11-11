import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound, forbidden } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/creators/me/campaigns/[campaignId]/tracking-link">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can access tracking links.");
    }

    const participant = await db.campaignParticipant.findFirst({
      where: { campaignId, creatorProfileId: creatorProfile.id },
    });
    if (!participant) {
      throw notFound("You are not a participant in this campaign.");
    }

    const link = await db.trackingLink.findFirst({
      where: { participantId: participant.id, active: true },
      orderBy: { createdAt: "desc" },
    });

    if (!link) {
      return json({ link: null });
    }

    return json({
      link: {
        id: link.id,
        token: link.token,
        path: `/r/${link.token}`,
        destinationUrl: link.destinationUrl,
        active: link.active,
        createdAt: link.createdAt,
      },
    });
  });
}
