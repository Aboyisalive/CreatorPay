import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/creators/me/campaigns/[campaignId]">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can view this campaign.");
    }

    const participant = await db.campaignParticipant.findFirst({
      where: { campaignId, creatorProfileId: creatorProfile.id },
      include: {
        acceptedTermVersion: {
          include: { rewardRules: { orderBy: { createdAt: "asc" } } },
        },
        trackingLinks: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { submissions: true } },
      },
    });
    if (!participant) {
      throw notFound("You are not a participant in this campaign.");
    }

    const campaign = await db.campaign.findFirst({
      where: { id: campaignId },
      include: {
        deliverableRequirements: { orderBy: { createdAt: "asc" } },
        workspace: { select: { name: true } },
      },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const [clicks, eligibleClicks, submissions] = await Promise.all([
      db.clickEvent.count({ where: { participantId: participant.id } }),
      db.clickEvent.count({
        where: { participantId: participant.id, isEligible: true },
      }),
      db.submission.findMany({
        where: { participantId: participant.id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewNote: true,
          deliverable: { select: { id: true, name: true } },
        },
      }),
    ]);

    const link = participant.trackingLinks[0];

    return json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        summary: campaign.summary,
        description: campaign.description,
        objectives: campaign.objectives,
        status: campaign.status,
        destinationUrl: campaign.destinationUrl,
        attributionModel: campaign.attributionModel,
        attributionWindowDays: campaign.attributionWindowDays,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
        currency: campaign.currency,
        businessName: campaign.workspace.name,
        deliverables: campaign.deliverableRequirements,
      },
      participation: {
        status: participant.status,
        acceptedAt: participant.acceptedAt,
        termVersion: participant.acceptedTermVersion
          ? {
              version: participant.acceptedTermVersion.version,
              snapshot: participant.acceptedTermVersion.snapshot,
              rewardRules: participant.acceptedTermVersion.rewardRules,
            }
          : null,
        submissions: participant._count.submissions,
      },
      link: link
        ? { id: link.id, token: link.token, path: `/r/${link.token}`, active: link.active }
        : null,
      performance: {
        clicks: { total: clicks, eligible: eligibleClicks },
        submissions,
      },
    });
  });
}
