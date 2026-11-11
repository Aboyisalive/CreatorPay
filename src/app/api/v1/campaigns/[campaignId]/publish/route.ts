import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { ApiError, conflict, notFound } from "@/lib/errors";
import { publishIssues } from "@/lib/campaigns";
import { recordAudit } from "@/lib/audit";
import { loadCampaignDetail } from "@/lib/campaign-view";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/publish">,
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

    if (campaign.status !== "DRAFT") {
      throw conflict("Only a draft campaign can be published.");
    }

    if (!campaign.currentTermVersion) {
      throw new ApiError(
        422,
        "campaign_not_ready",
        "Campaign has no terms to publish.",
      );
    }

    const issues = publishIssues(
      campaign,
      campaign.currentTermVersion.rewardRules,
    );

    if (issues.length > 0) {
      throw new ApiError(
        422,
        "campaign_not_ready",
        "Campaign is not ready to publish.",
        { issues },
      );
    }

    await db.$transaction([
      db.campaignTermVersion.update({
        where: { id: campaign.currentTermVersion.id },
        data: { publishedAt: new Date() },
      }),
      db.campaign.update({
        where: { id: campaign.id },
        data: { status: "PUBLISHED" },
      }),
    ]);

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "campaign.published",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { termVersion: campaign.currentTermVersion.version },
    });

    const detail = await loadCampaignDetail(campaign.id, context.workspace.id);
    return json({ campaign: detail.campaign });
  });
}
