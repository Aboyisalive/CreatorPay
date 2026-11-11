import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { reconcilePayout } from "@/lib/payments/payout";

/** Poll the provider for one payout's status and update state + ledger. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/payments/payouts/[payoutId]/reconcile">,
) {
  return withApi(request, async () => {
    const { payoutId } = await ctx.params;
    const user = await requireUser();

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      select: { rewardCalculation: { select: { campaign: { select: { workspaceId: true } } } } },
    });
    if (!payout) {
      throw notFound("Payout not found.");
    }

    const context = await requireWorkspace(user, payout.rewardCalculation.campaign.workspaceId);
    assertRole(context.role, FINANCE_ROLES);

    const updated = await reconcilePayout(payoutId, context.workspace.id);
    return json({ payout: updated });
  });
}
