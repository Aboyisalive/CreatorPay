import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { z } from "zod";
import { newOpaqueToken } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";

const issueLinkSchema = z.object({
  participantId: z.string().min(1, "Choose a participant."),
});

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/tracking-links">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const input = issueLinkSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, workspaceId: true, status: true, destinationUrl: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (campaign.status === "DRAFT" || campaign.status === "ARCHIVED") {
      throw conflict(
        "Tracking links can only be issued for published campaigns.",
      );
    }

    const participant = await db.campaignParticipant.findFirst({
      where: { id: input.participantId, campaignId },
      include: {
        trackingLinks: { where: { active: true }, take: 1 },
      },
    });
    if (!participant) {
      throw notFound("Participant not found for this campaign.");
    }
    if (participant.status !== "ACTIVE") {
      throw badRequest(
        "The creator must accept the terms before a tracking link can be issued.",
      );
    }
    if (participant.trackingLinks.length > 0) {
      throw conflict("This participant already has an active tracking link.");
    }

    const link = await db.trackingLink.create({
      data: {
        campaignId,
        participantId: participant.id,
        token: newOpaqueToken(),
        destinationUrl: campaign.destinationUrl,
      },
    });

    await recordAudit({
      workspaceId: campaign.workspaceId,
      actorUserId: user.id,
      action: "tracking_link.issued",
      entityType: "TrackingLink",
      entityId: link.id,
      metadata: { campaignId, participantId: participant.id },
    });

    return json(
      {
        link: {
          id: link.id,
          token: link.token,
          path: `/r/${link.token}`,
          active: link.active,
          createdAt: link.createdAt,
        },
      },
      201,
    );
  });
}
