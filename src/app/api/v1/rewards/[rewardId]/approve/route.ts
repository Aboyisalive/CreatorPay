import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/approve">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
      include: {
        campaign: { select: { id: true, workspaceId: true, name: true } },
        participant: { include: { creatorProfile: true } },
      },
    });

    if (!reward) {
      throw notFound("Reward not found.");
    }

    const context = await requireWorkspace(user, reward.campaign.workspaceId);
    assertRole(context.role, FINANCE_ROLES);

    if (!["CALCULATED", "PENDING_REVIEW"].includes(reward.status)) {
      throw conflict(`Reward is already ${reward.status.toLowerCase().replace(/_/g, " ")}.`);
    }

    const updated = await db.rewardCalculation.update({
      where: { id: reward.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedById: user.id,
      },
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "reward.approved",
      entityType: "RewardCalculation",
      entityId: reward.id,
      metadata: {
        campaignId: reward.campaignId,
        creatorName: reward.participant.creatorProfile.displayName,
        totalMinor: reward.totalMinor.toString(),
      },
    });

    await notify({
      userIds: [reward.participant.creatorProfile.userId],
      workspaceId: context.workspace.id,
      type: "reward.approved",
      title: "Reward approved",
      body: `${reward.campaign.name}: your reward was approved. Approved does not mean paid — settlement is a separate status.`,
      entityType: "RewardCalculation",
      entityId: reward.id,
    });

    return json({ reward: updated });
  });
}
