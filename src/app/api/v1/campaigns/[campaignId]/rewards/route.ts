import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/rewards">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const calculations = await db.rewardCalculation.findMany({
      where: { campaignId },
      orderBy: [{ participantId: "asc" }, { version: "desc" }],
      include: {
        participant: { include: { creatorProfile: true } },
        lines: true,
        termVersion: { select: { version: true } },
      },
    });

    const latest = new Map<string, (typeof calculations)[number]>();
    for (const calculation of calculations) {
      if (!latest.has(calculation.participantId)) {
        latest.set(calculation.participantId, calculation);
      }
    }

    return json({
      rewards: [...latest.values()].map((reward) => ({
        id: reward.id,
        participantId: reward.participantId,
        creatorName: reward.participant.creatorProfile.displayName,
        version: reward.version,
        status: reward.status,
        currency: reward.currency,
        totalMinor: reward.totalMinor,
        calculatedAt: reward.calculatedAt,
        approvedAt: reward.approvedAt,
        termVersion: reward.termVersion.version,
        breakdown: reward.breakdown,
        lines: reward.lines,
      })),
    });
  });
}
