import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { newOpaqueToken, sha256 } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/invitations/[token]/accept">,
) {
  return withApi(request, async () => {
    const { token } = await ctx.params;
    const user = await requireUser();

    const invitation = await db.campaignInvitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        campaign: {
          include: { currentTermVersion: true },
        },
      },
    });

    if (!invitation) {
      throw notFound("This invitation link is not valid.");
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw forbidden(
        `This invitation was sent to ${invitation.email}. Sign in with that email to accept it.`,
      );
    }

    if (invitation.status === "ACCEPTED") {
      throw conflict("This invitation has already been accepted.");
    }

    if (invitation.status !== "PENDING") {
      throw conflict("This invitation can no longer be accepted.");
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      throw conflict("This invitation has expired.");
    }

    if (invitation.campaign.status !== "PUBLISHED") {
      throw conflict("This campaign is not currently accepting participants.");
    }

    const termVersion = invitation.campaign.currentTermVersion;
    if (!termVersion || !termVersion.publishedAt) {
      throw conflict("The campaign terms are not published yet.");
    }

    // Single-role accounts: only creator accounts can participate. A
    // business account must register a creator account to accept.
    const creatorProfile = user.creatorProfile;
    if (!creatorProfile) {
      throw forbidden(
        "This invitation is for a creator account. Sign in with the creator account you want to use, or create one first.",
      );
    }

    const result = await db.$transaction(async (tx) => {
      const existingParticipant = await tx.campaignParticipant.findUnique({
        where: {
          campaignId_creatorProfileId: {
            campaignId: invitation.campaignId,
            creatorProfileId: creatorProfile.id,
          },
        },
      });

      const participant = existingParticipant
        ? await tx.campaignParticipant.update({
            where: { id: existingParticipant.id },
            data: {
              status: "ACTIVE",
              acceptedTermVersionId: termVersion.id,
              acceptedAt: new Date(),
            },
          })
        : await tx.campaignParticipant.create({
            data: {
              campaignId: invitation.campaignId,
              creatorProfileId: creatorProfile.id,
              status: "ACTIVE",
              acceptedTermVersionId: termVersion.id,
              acceptedAt: new Date(),
            },
          });

      const existingLink = await tx.trackingLink.findFirst({
        where: { participantId: participant.id, active: true },
        orderBy: { createdAt: "desc" },
      });

      const link =
        existingLink ??
        (await tx.trackingLink.create({
          data: {
            campaignId: invitation.campaignId,
            participantId: participant.id,
            token: newOpaqueToken(),
            destinationUrl: invitation.campaign.destinationUrl,
          },
        }));

      await tx.campaignInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          respondedAt: new Date(),
          creatorProfileId: creatorProfile.id,
        },
      });

      return { participant, link };
    });

    await recordAudit({
      workspaceId: invitation.campaign.workspaceId,
      actorUserId: user.id,
      action: "invitation.accepted",
      entityType: "CampaignParticipant",
      entityId: result.participant.id,
      metadata: {
        campaignId: invitation.campaignId,
        termVersion: termVersion.version,
      },
    });

    return json({
      campaignId: invitation.campaignId,
      participantId: result.participant.id,
      trackingPath: `/r/${result.link.token}`,
    });
  });
}
