import { z } from "zod";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { notFound, badRequest } from "@/lib/errors";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money-server";
import { simulateDeposit } from "@/lib/payments/funding";

const simulateSchema = z.object({
  amountMinor: z.union([z.string(), z.number()]),
});

/**
 * FundingSimulator: posts a synthetic deposit into a campaign's escrow through
 * the same ingest path a real webhook uses (plan milestone 5). Demo/test aid.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/funding/simulate">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, FINANCE_ROLES);

    const input = simulateSchema.parse(await readJson(request));
    const raw = String(input.amountMinor).trim();
    if (!/^\d+$/.test(raw)) {
      throw badRequest("amountMinor must be a non-negative integer (kobo).", { field: "amountMinor" });
    }
    const amountMinor = toMinor(raw);
    if (amountMinor.lte(0)) {
      throw badRequest("amountMinor must be greater than zero.", { field: "amountMinor" });
    }

    const deposit = await simulateDeposit({
      campaignId,
      workspaceId: context.workspace.id,
      amountMinor,
    });

    return json({ deposit }, 201);
  });
}
