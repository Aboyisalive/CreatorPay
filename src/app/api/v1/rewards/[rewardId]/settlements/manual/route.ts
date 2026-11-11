import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const manualSettlementSchema = z.object({
  method: z.string().trim().min(1).max(100),
  reference: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/settlements/manual">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();
    const input = manualSettlementSchema.parse(await readJson(request));

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

    if (reward.status === "PAID") {
      throw conflict("This reward is already marked as paid.");
    }
    if (reward.status === "DISPUTED") {
      throw conflict("Cannot record settlement on a disputed reward.");
    }
    if (!["APPROVED", "PAYABLE", "PAYMENT_INITIATED"].includes(reward.status)) {
      throw conflict("Only approved or payable rewards can be settled.");
    }

    const [settlement, updatedReward] = await db.$transaction([
      db.settlement.create({
        data: {
          rewardCalculationId: rewardId,
          amountMinor: reward.totalMinor,
          currency: reward.currency,
          method: input.method,
          reference: input.reference,
          note: input.note,
          recordedById: user.id,
        },
      }),
      db.rewardCalculation.update({
        where: { id: rewardId },
        data: { status: "PAID" },
      }),
    ]);

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "reward.settlement_recorded",
      entityType: "Settlement",
      entityId: settlement.id,
      metadata: {
        campaignId: reward.campaignId,
        rewardCalculationId: rewardId,
        amountMinor: reward.totalMinor.toString(),
        method: input.method,
        reference: input.reference,
        note: "Manual settlement record — no payment provider is connected.",
      },
    });

    await notify({
      userIds: [reward.participant.creatorProfile.userId],
      workspaceId: context.workspace.id,
      type: "reward.settled",
      title: "Settlement recorded",
      body: `${reward.campaign.name}: a settlement reference was recorded manually by the business. This is an operator-entered status, not a provider confirmation.`,
      entityType: "RewardCalculation",
      entityId: rewardId,
    });

    return json({
      settlement,
      reward: updatedReward,
      message:
        "Settlement recorded manually. This is an operator-entered status, not a provider-confirmed transfer.",
    });
  });
}
