import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/settlements">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();

    const reward = await db.rewardCalculation.findUnique({
      where: { id: rewardId },
      select: { id: true, campaign: { select: { workspaceId: true } } },
    });
    if (!reward) {
      throw notFound("Reward not found.");
    }
    await requireWorkspace(user, reward.campaign.workspaceId);

    const settlements = await db.settlement.findMany({
      where: { rewardCalculationId: rewardId },
      orderBy: { createdAt: "desc" },
      include: { recordedBy: { select: { name: true, email: true } } },
    });

    return json({
      settlements: settlements.map((s) => ({
        id: s.id,
        amountMinor: s.amountMinor,
        currency: s.currency,
        method: s.method,
        reference: s.reference,
        note: s.note,
        recordedBy: s.recordedBy,
        createdAt: s.createdAt,
      })),
    });
  });
}
