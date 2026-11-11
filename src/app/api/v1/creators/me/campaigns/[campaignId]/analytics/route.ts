import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound, forbidden } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/creators/me/campaigns/[campaignId]/analytics">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can view analytics.");
    }

    const participant = await db.campaignParticipant.findFirst({
      where: { campaignId, creatorProfileId: creatorProfile.id },
    });
    if (!participant) {
      throw notFound("You are not a participant in this campaign.");
    }

    const [totalClicks, eligibleClicks, totalEvents, verifiedEvents, eligibleEvents] =
      await Promise.all([
        db.clickEvent.count({ where: { participantId: participant.id } }),
        db.clickEvent.count({
          where: { participantId: participant.id, isEligible: true },
        }),
        db.conversionEvent.count({
          where: { participantId: participant.id, isTest: false },
        }),
        db.conversionEvent.count({
          where: {
            participantId: participant.id,
            isTest: false,
            verificationStatus: "VERIFIED",
          },
        }),
        db.conversionEvent.count({
          where: {
            participantId: participant.id,
            isTest: false,
            eligibilityStatus: "ELIGIBLE",
            verificationStatus: "VERIFIED",
          },
        }),
      ]);

    return json({
      campaignId,
      participantId: participant.id,
      clicks: {
        total: totalClicks,
        eligible: eligibleClicks,
      },
      events: {
        total: totalEvents,
        verified: verifiedEvents,
        eligible: eligibleEvents,
      },
    });
  });
}
