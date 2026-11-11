import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS, FINANCE_ROLES } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { getFundingInstructions } from "@/lib/payments/funding";

/** Fetch (or mint) a campaign's funding instructions. */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/funding">,
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
    assertRole(context.role, [...CAMPAIGN_MANAGERS, ...FINANCE_ROLES]);

    const instructions = await getFundingInstructions(campaignId, context.workspace.id);
    return json({ funding: instructions });
  });
}
