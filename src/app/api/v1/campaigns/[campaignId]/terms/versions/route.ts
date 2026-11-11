import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/terms/versions">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      select: { workspaceId: true, currentTermVersionId: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }
    await requireWorkspace(user, campaign.workspaceId);

    const versions = await db.campaignTermVersion.findMany({
      where: { campaignId },
      orderBy: { version: "desc" },
      include: {
        rewardRules: { orderBy: { createdAt: "asc" } },
        _count: { select: { acceptedBy: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    return json({
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
        snapshot: v.snapshot,
        rewardRules: v.rewardRules,
        acceptedCount: v._count.acceptedBy,
        createdBy: v.createdBy,
        isCurrent: v.id === campaign.currentTermVersionId,
      })),
    });
  });
}
