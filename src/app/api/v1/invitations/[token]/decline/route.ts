import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { sha256 } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/invitations/[token]/decline">,
) {
  return withApi(request, async () => {
    const { token } = await ctx.params;
    const user = await requireUser();

    const invitation = await db.campaignInvitation.findUnique({
      where: { tokenHash: sha256(token) },
    });

    if (!invitation) {
      throw notFound("This invitation link is not valid.");
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw forbidden("This invitation belongs to a different email address.");
    }

    if (invitation.status !== "PENDING") {
      throw conflict("This invitation can no longer be declined.");
    }

    await db.campaignInvitation.update({
      where: { id: invitation.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });

    await recordAudit({
      actorUserId: user.id,
      action: "invitation.declined",
      entityType: "CampaignInvitation",
      entityId: invitation.id,
      metadata: { campaignId: invitation.campaignId },
    });

    return json({ ok: true });
  });
}
