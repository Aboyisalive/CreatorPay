import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { ZERO_MINOR } from "@/lib/money-server";

export async function listCampaignsForWorkspace(workspaceId: string) {
  return db.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      currentTermVersion: {
        include: { rewardRules: { orderBy: { createdAt: "asc" } } },
      },
      _count: {
        select: {
          participants: true,
          clickEvents: true,
          conversionEvents: true,
        },
      },
    },
  });
}

export async function loadCampaignDetail(
  campaignId: string,
  workspaceId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: {
      currentTermVersion: {
        include: { rewardRules: { orderBy: { createdAt: "asc" } } },
      },
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          creatorProfile: {
            include: {
              user: { select: { email: true, name: true } },
            },
          },
          acceptedTermVersion: { select: { version: true } },
          trackingLinks: {
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { clickEvents: true, conversionEvents: true },
          },
        },
      },
      rewardCalculations: {
        orderBy: [{ participantId: "asc" }, { version: "desc" }],
      },
      conversionEvents: {
        orderBy: { receivedAt: "desc" },
        take: 25,
        include: {
          participant: { include: { creatorProfile: true } },
        },
      },
    },
  });

  if (!campaign) {
    throw notFound("Campaign not found.");
  }

  const [rawClicks, eligibleClicks, totalEvents, eligibleEvents] =
    await Promise.all([
      db.clickEvent.count({ where: { campaignId } }),
      db.clickEvent.count({ where: { campaignId, isEligible: true } }),
      db.conversionEvent.count({ where: { campaignId, isTest: false } }),
      db.conversionEvent.count({
        where: {
          campaignId,
          isTest: false,
          eligibilityStatus: "ELIGIBLE",
          verificationStatus: "VERIFIED",
        },
      }),
    ]);

  const latestRewards = new Map<string, (typeof campaign.rewardCalculations)[number]>();
  for (const calculation of campaign.rewardCalculations) {
    if (!latestRewards.has(calculation.participantId)) {
      latestRewards.set(calculation.participantId, calculation);
    }
  }

  let calculatedMinor = ZERO_MINOR;
  let approvedMinor = ZERO_MINOR;
  let paidMinor = ZERO_MINOR;

  for (const reward of latestRewards.values()) {
    if (reward.status === "CALCULATED" || reward.status === "PENDING_REVIEW") {
      calculatedMinor = calculatedMinor.plus(reward.totalMinor);
    }
    if (
      ["APPROVED", "PAYABLE", "PAYMENT_INITIATED", "PAID"].includes(
        reward.status,
      )
    ) {
      approvedMinor = approvedMinor.plus(reward.totalMinor);
    }
    if (reward.status === "PAID") {
      paidMinor = paidMinor.plus(reward.totalMinor);
    }
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      summary: campaign.summary,
      description: campaign.description,
      objectives: campaign.objectives,
      status: campaign.status,
      fundingStatus: campaign.fundingStatus,
      participationMode: campaign.participationMode,
      attributionModel: campaign.attributionModel,
      attributionWindowDays: campaign.attributionWindowDays,
      destinationUrl: campaign.destinationUrl,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      budgetMinor: campaign.budgetMinor,
      currency: campaign.currency,
      createdAt: campaign.createdAt,
      currentTermVersion: campaign.currentTermVersion
        ? {
            id: campaign.currentTermVersion.id,
            version: campaign.currentTermVersion.version,
            publishedAt: campaign.currentTermVersion.publishedAt,
            snapshot: campaign.currentTermVersion.snapshot,
            rewardRules: campaign.currentTermVersion.rewardRules,
          }
        : null,
    },
    stats: {
      participants: campaign.participants.length,
      activeParticipants: campaign.participants.filter(
        (participant) => participant.status === "ACTIVE",
      ).length,
      rawClicks,
      eligibleClicks,
      totalEvents,
      eligibleEvents,
      calculatedMinor,
      approvedMinor,
      paidMinor,
    },
    participants: campaign.participants.map((participant) => {
      const reward = latestRewards.get(participant.id);
      const link = participant.trackingLinks[0] ?? null;
      return {
        id: participant.id,
        status: participant.status,
        acceptedAt: participant.acceptedAt,
        acceptedTermVersion: participant.acceptedTermVersion?.version ?? null,
        creator: {
          id: participant.creatorProfile.id,
          displayName: participant.creatorProfile.displayName,
          email:
            participant.creatorProfile.user.email ??
            participant.creatorProfile.user.name,
        },
        link: link
          ? {
              id: link.id,
              token: link.token,
              path: `/r/${link.token}`,
              destinationUrl: link.destinationUrl,
              active: link.active,
            }
          : null,
        clicks: participant._count.clickEvents,
        events: participant._count.conversionEvents,
        latestReward: reward
          ? {
              id: reward.id,
              version: reward.version,
              status: reward.status,
              totalMinor: reward.totalMinor,
              calculatedAt: reward.calculatedAt,
              approvedAt: reward.approvedAt,
            }
          : null,
      };
    }),
    recentEvents: campaign.conversionEvents.map((event) => ({
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
      participant: event.participant
        ? {
            id: event.participant.id,
            creatorName: event.participant.creatorProfile.displayName,
          }
        : null,
    })),
  };
}
