import { z } from "zod";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import { matchDeposit } from "@/lib/payments/funding";

const matchSchema = z.object({ campaignId: z.string().min(1) });

/** Resolve an unmatched deposit into a campaign's escrow (finance only). */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/payments/deposits/[depositId]/match">,
) {
  return withApi(request, async () => {
    const { depositId } = await ctx.params;
    const user = await requireUser();
    const input = matchSchema.parse(await readJson(request));

    const deposit = await db.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) {
      throw notFound("Deposit not found.");
    }

    const context = await requireWorkspace(user);
    assertRole(context.role, FINANCE_ROLES);

    const matched = await matchDeposit({
      depositId,
      campaignId: input.campaignId,
      actorUserId: user.id,
      workspaceId: context.workspace.id,
    });

    return json({ deposit: matched });
  });
}
