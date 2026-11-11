import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { getLatestPayoutForReward, initiatePayout } from "@/lib/payments/payout";

async function loadRewardContext(rewardId: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const reward = await db.rewardCalculation.findUnique({
    where: { id: rewardId },
    select: { id: true, campaign: { select: { workspaceId: true } } },
  });
  if (!reward) {
    throw notFound("Reward not found.");
  }
  const context = await requireWorkspace(user, reward.campaign.workspaceId);
  assertRole(context.role, FINANCE_ROLES);
  return context;
}

/** Initiate a real payout for an approved reward (finance only). */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/payout">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();
    const context = await loadRewardContext(rewardId, user);

    const payout = await initiatePayout({
      rewardId,
      actorUserId: user.id,
      workspaceId: context.workspace.id,
    });

    return json({ payout }, 201);
  });
}

/** The latest payout attempt for this reward (poll to see status change). */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/rewards/[rewardId]/payout">,
) {
  return withApi(request, async () => {
    const { rewardId } = await ctx.params;
    const user = await requireUser();
    await loadRewardContext(rewardId, user);

    const payout = await getLatestPayoutForReward(rewardId);
    return json({ payout });
  });
}
