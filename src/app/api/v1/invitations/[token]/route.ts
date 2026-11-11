import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { sha256 } from "@/lib/tokens";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/invitations/[token]">,
) {
  return withApi(request, async () => {
    const { token } = await ctx.params;

    const invitation = await db.campaignInvitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        campaign: {
          include: {
            workspace: { select: { name: true } },
            currentTermVersion: {
              include: { rewardRules: { orderBy: { createdAt: "asc" } } },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw notFound("This invitation link is not valid.");
    }

    const expired =
      invitation.status === "PENDING" &&
      invitation.expiresAt !== null &&
      invitation.expiresAt.getTime() < Date.now();

    return json({
      invitation: {
        email: invitation.email,
        status: expired ? "EXPIRED" : invitation.status,
        expiresAt: invitation.expiresAt,
      },
      business: { name: invitation.campaign.workspace.name },
      campaign: {
        id: invitation.campaign.id,
        name: invitation.campaign.name,
        summary: invitation.campaign.summary,
        description: invitation.campaign.description,
        objectives: invitation.campaign.objectives,
        status: invitation.campaign.status,
        destinationUrl: invitation.campaign.destinationUrl,
        startAt: invitation.campaign.startAt,
        endAt: invitation.campaign.endAt,
        attributionWindowDays: invitation.campaign.attributionWindowDays,
        budgetMinor: invitation.campaign.budgetMinor,
        currency: invitation.campaign.currency,
        rewardRules:
          invitation.campaign.currentTermVersion?.rewardRules ?? [],
        terms: invitation.campaign.currentTermVersion?.snapshot ?? null,
        termVersion: invitation.campaign.currentTermVersion?.version ?? null,
      },
    });
  });
}
