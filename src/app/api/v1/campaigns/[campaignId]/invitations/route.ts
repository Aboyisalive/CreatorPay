import { db } from "@/lib/db";
import { json, publicOrigin, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { inviteCreatorSchema } from "@/lib/validation";
import { newOpaqueToken, sha256 } from "@/lib/tokens";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/invitations">,
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
    await requireWorkspace(user, campaign.workspaceId);

    const invitations = await db.campaignInvitation.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });

    return json({ invitations });
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/invitations">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const input = inviteCreatorSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { workspace: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (campaign.status !== "PUBLISHED") {
      throw conflict("Publish the campaign before inviting creators.");
    }

    const creatorUser = await db.user.findUnique({
      where: { email: input.email },
      include: { creatorProfile: true },
    });

    const existing = await db.campaignInvitation.findUnique({
      where: {
        campaignId_email: { campaignId: campaign.id, email: input.email },
      },
    });

    if (existing?.status === "ACCEPTED") {
      throw conflict("That creator has already accepted this campaign.");
    }

    // Only a hash of the token is stored. Re-inviting always rotates the token,
    // so any previously shared link stops working; the new link is shown once.
    const token = newOpaqueToken();
    const tokenHash = sha256(token);

    const invitation = existing
      ? await db.campaignInvitation.update({
          where: { id: existing.id },
          data: {
            tokenHash,
            status: "PENDING",
            respondedAt: null,
            acceptedAt: null,
            creatorProfileId: creatorUser?.creatorProfile?.id ?? null,
            expiresAt: campaign.endAt,
          },
        })
      : await db.campaignInvitation.create({
          data: {
            campaignId: campaign.id,
            email: input.email,
            tokenHash,
            invitedById: user.id,
            creatorProfileId: creatorUser?.creatorProfile?.id ?? null,
            expiresAt: campaign.endAt,
          },
        });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "invitation.sent",
      entityType: "CampaignInvitation",
      entityId: invitation.id,
      metadata: { email: input.email, campaignId: campaign.id },
    });

    return json(
      {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        // Shown once at creation. Only the hash is stored, so it cannot be
        // re-shown later; re-inviting issues a fresh link.
        inviteUrl: new URL(`/invite/${token}`, publicOrigin(request)).toString(),
        existingAccount: Boolean(creatorUser),
      },
      201,
    );
  });
}
