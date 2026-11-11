import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
      include: {
        campaign: { select: { id: true, name: true, workspaceId: true, currency: true } },
        participant: {
          include: {
            creatorProfile: {
              include: { user: { select: { email: true, name: true } } },
            },
          },
        },
        termVersion: { select: { version: true, publishedAt: true, snapshot: true } },
        lines: { orderBy: { id: "asc" } },
        approvedBy: { select: { name: true, email: true } },
        settlements: {
          orderBy: { createdAt: "desc" },
          include: { recordedBy: { select: { name: true, email: true } } },
        },
      },
    });
    if (!reward) {
      throw notFound("Reward not found.");
    }

    // Visible to workspace members, or to the creator whose reward it is.
    const profile = await db.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    const isOwnReward =
      Boolean(profile) && profile!.id === reward.participant.creatorProfileId;
    if (!isOwnReward) {
      await requireWorkspace(user, reward.campaign.workspaceId);
    }

    return json({
      reward: {
        id: reward.id,
        campaign: reward.campaign,
        version: reward.version,
        status: reward.status,
        currency: reward.currency,
        totalMinor: reward.totalMinor,
        breakdown: reward.breakdown,
        calculatedAt: reward.calculatedAt,
        approvedAt: reward.approvedAt,
        approvedBy: reward.approvedBy,
        disputedAt: reward.disputedAt,
        disputeReason: reward.disputeReason,
        notes: reward.notes,
        termVersion: reward.termVersion,
        lines: reward.lines,
        settlements: reward.settlements,
        creator: {
          displayName: reward.participant.creatorProfile.displayName,
          email: reward.participant.creatorProfile.user.email,
        },
        viewerIsCreator: Boolean(isOwnReward),
      },
    });
  });
}
