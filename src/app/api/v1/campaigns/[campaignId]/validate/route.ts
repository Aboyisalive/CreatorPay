import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { publishIssues } from "@/lib/campaigns";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/validate">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        currentTermVersion: {
          include: { rewardRules: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    const issues = campaign.currentTermVersion
      ? publishIssues(campaign, campaign.currentTermVersion.rewardRules)
      : ["Campaign has no terms to publish."];

    return json({
      ready: issues.length === 0,
      issues,
      status: campaign.status,
    });
  });
}
