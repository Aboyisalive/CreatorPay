import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { forbidden } from "@/lib/errors";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();

    const creatorProfile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!creatorProfile) {
      throw forbidden("Only creators can view this overview.");
    }

    const participants = await db.campaignParticipant.findMany({
      where: { creatorProfileId: creatorProfile.id },
      include: {
        campaign: { select: { id: true, name: true, status: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const participantIds = participants.map((p) => p.id);

    const [submissions, rewards, pendingRevisions, unreadNotifications] =
      await Promise.all([
        db.submission.count({
          where: { participantId: { in: participantIds } },
        }),
        db.rewardCalculation.findMany({
          where: { participantId: { in: participantIds } },
          orderBy: { calculatedAt: "desc" },
        }),
        db.submission.count({
          where: {
            participantId: { in: participantIds },
            status: "REVISION_REQUESTED",
          },
        }),
        db.notification.count({
          where: { userId: user.id, readAt: null },
        }),
      ]);

    const statusCounts = participants.reduce<Record<string, number>>(
      (acc, p) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const rewardStatusCounts = rewards.reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return json({
      profile: {
        displayName: creatorProfile.displayName,
        bio: creatorProfile.bio,
        phone: creatorProfile.phone,
      },
      campaigns: {
        total: participants.length,
        byStatus: statusCounts,
      },
      submissions: {
        total: submissions,
        needingRevision: pendingRevisions,
      },
      rewards: {
        total: rewards.length,
        byStatus: rewardStatusCounts,
      },
      unreadNotifications,
    });
  });
}
