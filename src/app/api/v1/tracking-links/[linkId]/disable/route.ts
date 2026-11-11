import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound, conflict } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/tracking-links/[linkId]/disable">,
) {
  return withApi(request, async () => {
    const { linkId } = await ctx.params;
    const user = await requireUser();

    const link = await db.trackingLink.findUnique({
      where: { id: linkId },
      include: { campaign: { include: { workspace: true } } },
    });
    if (!link) {
      throw notFound("Tracking link not found.");
    }

    const context = await requireWorkspace(user, link.campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (!link.active) {
      throw conflict("This tracking link is already disabled.");
    }

    const updated = await db.trackingLink.update({
      where: { id: linkId },
      data: { active: false, disabledAt: new Date() },
    });

    await recordAudit({
      workspaceId: link.campaign.workspaceId,
      actorUserId: user.id,
      action: "tracking_link.disabled",
      entityType: "TrackingLink",
      entityId: linkId,
      metadata: { campaignId: link.campaignId, participantId: link.participantId },
    });

    return json({ link: { id: updated.id, token: updated.token, active: updated.active } });
  });
}
