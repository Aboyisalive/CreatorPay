import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/settle">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
      include: {
        campaign: { select: { id: true, workspaceId: true } },
      },
    });

    if (!reward) {
      throw notFound("Reward not found.");
    }

    const context = await requireWorkspace(user, reward.campaign.workspaceId);
    assertRole(context.role, FINANCE_ROLES);

    if (reward.status !== "APPROVED") {
      throw conflict("Only an approved reward can be marked payable.");
    }

    const updated = await db.rewardCalculation.update({
      where: { id: reward.id },
      data: { status: "PAYABLE" },
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "reward.marked_payable",
      entityType: "RewardCalculation",
      entityId: reward.id,
      metadata: {
        campaignId: reward.campaignId,
        totalMinor: reward.totalMinor.toString(),
        note: "No payment provider is connected; no funds have moved.",
      },
    });

    return json({
      reward: updated,
      message:
        "Marked payable. No payment provider is connected yet, so no money has moved.",
    });
  });
}
