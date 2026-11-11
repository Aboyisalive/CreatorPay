import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const disputeSchema = z.object({
  reason: z.string().trim().min(1, "Provide a reason for the dispute.").max(2000),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/dispute">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();
    const input = disputeSchema.parse(await readJson(request));

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
      include: {
        campaign: { select: { id: true, name: true, workspaceId: true } },
        participant: { include: { creatorProfile: true } },
      },
    });
    if (!reward) {
      throw notFound("Reward not found.");
    }

    const context = await requireWorkspace(user, reward.campaign.workspaceId);
    assertRole(context.role, FINANCE_ROLES);

    if (["PAID", "DISPUTED"].includes(reward.status)) {
      throw conflict(`Cannot dispute a reward that is ${reward.status.toLowerCase()}.`);
    }

    const updated = await db.rewardCalculation.update({
      where: { id: rewardId },
      data: {
        status: "DISPUTED",
        disputedAt: new Date(),
        disputeReason: input.reason,
      },
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "reward.disputed",
      entityType: "RewardCalculation",
      entityId: rewardId,
      metadata: {
        campaignId: reward.campaignId,
        previousStatus: reward.status,
        reason: input.reason,
      },
    });

    await notify({
      userIds: [reward.participant.creatorProfile.userId],
      workspaceId: context.workspace.id,
      type: "reward.disputed",
      title: "Reward disputed",
      body: `${reward.campaign.name}: a dispute was recorded. Settlement is blocked until it is resolved.`,
      entityType: "RewardCalculation",
      entityId: rewardId,
    });

    return json({ reward: updated });
  });
}
