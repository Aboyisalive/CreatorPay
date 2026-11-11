import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/close">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (!["PUBLISHED", "PAUSED"].includes(campaign.status)) {
      throw conflict("Only a published or paused campaign can be closed.");
    }

    const updated = await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "CLOSED" },
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "campaign.closed",
      entityType: "Campaign",
      entityId: campaign.id,
    });

    return json({ campaign: { id: updated.id, status: updated.status } });
  });
}
