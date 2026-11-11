import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/archive">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, workspaceId: true, status: true, name: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (campaign.status === "ARCHIVED") {
      throw conflict("This campaign is already archived.");
    }
    if (!["CLOSED", "DRAFT"].includes(campaign.status)) {
      throw conflict(
        "Close the campaign before archiving it. Archiving stops all activity.",
      );
    }

    const updated = await db.campaign.update({
      where: { id: campaignId },
      data: { status: "ARCHIVED" },
    });

    await recordAudit({
      workspaceId: campaign.workspaceId,
      actorUserId: user.id,
      action: "campaign.archived",
      entityType: "Campaign",
      entityId: campaignId,
      metadata: { previousStatus: campaign.status, name: campaign.name },
    });

    return json({ campaign: updated });
  });
}
