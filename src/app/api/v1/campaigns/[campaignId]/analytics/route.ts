import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ZERO_MINOR } from "@/lib/money-server";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/analytics">,
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

    const [
      totalClicks,
      eligibleClicks,
      eventsByVerification,
      eventsByEligibility,
      rewardsByStatus,
      participantsByStatus,
      submissionsByStatus,
    ] = await Promise.all([
      db.clickEvent.count({ where: { campaignId } }),
      db.clickEvent.count({ where: { campaignId, isEligible: true } }),
      db.conversionEvent.groupBy({
        by: ["verificationStatus"],
        where: { campaignId, isTest: false },
        _count: true,
      }),
      db.conversionEvent.groupBy({
        by: ["eligibilityStatus"],
        where: { campaignId, isTest: false },
        _count: true,
      }),
      db.rewardCalculation.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
        _sum: { totalMinor: true },
      }),
      db.campaignParticipant.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      }),
      db.submission.groupBy({
        by: ["status"],
        where: { campaignId },
        _count: true,
      }),
    ]);

    const totalEvents = eventsByVerification.reduce(
      (sum, row) => sum + row._count,
      0,
    );

    return json({
      campaignId,
      clicks: { total: totalClicks, eligible: eligibleClicks },
      events: {
        total: totalEvents,
        byVerification: Object.fromEntries(
          eventsByVerification.map((r) => [r.verificationStatus, r._count]),
        ),
        byEligibility: Object.fromEntries(
          eventsByEligibility.map((r) => [r.eligibilityStatus, r._count]),
        ),
      },
      participants: Object.fromEntries(
        participantsByStatus.map((r) => [r.status, r._count]),
      ),
      submissions: Object.fromEntries(
        submissionsByStatus.map((r) => [r.status, r._count]),
      ),
      rewards: {
        byStatus: Object.fromEntries(
          rewardsByStatus.map((r) => [r.status, r._count]),
        ),
        totalMinorByStatus: Object.fromEntries(
          rewardsByStatus.map((r) => [r.status, (r._sum.totalMinor ?? ZERO_MINOR).toString()]),
        ),
      },
    });
  });
}
