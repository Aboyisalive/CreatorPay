import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();

    if (!user.creatorProfile) {
      return json({ campaigns: [] });
    }

    const participants = await db.campaignParticipant.findMany({
      where: { creatorProfileId: user.creatorProfile.id },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          include: {
            workspace: { select: { name: true } },
            currentTermVersion: {
              include: { rewardRules: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
        trackingLinks: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        rewardCalculations: {
          orderBy: { version: "desc" },
          take: 1,
        },
        _count: { select: { clickEvents: true, conversionEvents: true } },
      },
    });

    const participantIds = participants.map((participant) => participant.id);

    const [eligibleClickGroups, eligibleEventGroups] = await Promise.all([
      participantIds.length
        ? db.clickEvent.groupBy({
            by: ["participantId"],
            where: { participantId: { in: participantIds }, isEligible: true },
            _count: { _all: true },
          })
        : [],
      participantIds.length
        ? db.conversionEvent.groupBy({
            by: ["participantId"],
            where: {
              participantId: { in: participantIds },
              eligibilityStatus: "ELIGIBLE",
              verificationStatus: "VERIFIED",
              isTest: false,
            },
            _count: { _all: true },
          })
        : [],
    ]);

    const eligibleClicks = new Map(
      eligibleClickGroups.map((group) => [
        group.participantId,
        group._count._all,
      ]),
    );
    const eligibleEvents = new Map(
      eligibleEventGroups.map((group) => [
        group.participantId!,
        group._count._all,
      ]),
    );

    return json({
      campaigns: participants.map((participant) => {
        const link = participant.trackingLinks[0] ?? null;
        const reward = participant.rewardCalculations[0] ?? null;
        return {
          participantId: participant.id,
          status: participant.status,
          acceptedAt: participant.acceptedAt,
          termVersion: participant.campaign.currentTermVersion?.version ?? null,
          campaign: {
            id: participant.campaign.id,
            name: participant.campaign.name,
            summary: participant.campaign.summary,
            status: participant.campaign.status,
            businessName: participant.campaign.workspace.name,
            attributionWindowDays:
              participant.campaign.attributionWindowDays,
            startAt: participant.campaign.startAt,
            endAt: participant.campaign.endAt,
            rewardRules:
              participant.campaign.currentTermVersion?.rewardRules ?? [],
            currency: participant.campaign.currency,
          },
          link: link
            ? { token: link.token, path: `/r/${link.token}` }
            : null,
          clicks: participant._count.clickEvents,
          eligibleClicks: eligibleClicks.get(participant.id) ?? 0,
          events: participant._count.conversionEvents,
          eligibleEvents: eligibleEvents.get(participant.id) ?? 0,
          reward: reward
            ? {
                id: reward.id,
                version: reward.version,
                status: reward.status,
                totalMinor: reward.totalMinor,
                currency: reward.currency,
                calculatedAt: reward.calculatedAt,
                approvedAt: reward.approvedAt,
                breakdown: reward.breakdown,
              }
            : null,
        };
      }),
    });
  });
}
