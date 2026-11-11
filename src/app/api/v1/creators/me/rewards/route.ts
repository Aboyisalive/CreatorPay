import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    if (!user.creatorProfile) {
      return json({ rewards: [] });
    }

    const rewards = await db.rewardCalculation.findMany({
      where: {
        participant: { creatorProfileId: user.creatorProfile.id },
      },
      orderBy: [{ participantId: "asc" }, { version: "desc" }],
      include: {
        campaign: { select: { id: true, name: true, currency: true } },
        lines: true,
      },
    });

    const latest = new Map<string, (typeof rewards)[number]>();
    for (const reward of rewards) {
      if (!latest.has(reward.participantId)) {
        latest.set(reward.participantId, reward);
      }
    }

    return json({
      rewards: [...latest.values()].map((reward) => ({
        id: reward.id,
        campaign: reward.campaign,
        version: reward.version,
        status: reward.status,
        totalMinor: reward.totalMinor,
        currency: reward.currency,
        calculatedAt: reward.calculatedAt,
        approvedAt: reward.approvedAt,
        breakdown: reward.breakdown,
        lines: reward.lines,
      })),
    });
  });
}
