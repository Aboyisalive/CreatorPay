import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { notFound } from "@/lib/errors";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/clicks">,
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

    const [total, eligible, recentClicks] = await Promise.all([
      db.clickEvent.count({ where: { campaignId } }),
      db.clickEvent.count({ where: { campaignId, isEligible: true } }),
      db.clickEvent.findMany({
        where: { campaignId },
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          participant: {
            include: {
              creatorProfile: { select: { displayName: true } },
            },
          },
          trackingLink: { select: { token: true } },
        },
      }),
    ]);

    // Aggregate by date
    const dailyMap = new Map<string, { total: number; eligible: number }>();
    for (const click of recentClicks) {
      const dateKey = click.occurredAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateKey) ?? { total: 0, eligible: 0 };
      entry.total += 1;
      if (click.isEligible) entry.eligible += 1;
      dailyMap.set(dateKey, entry);
    }

    const byDate = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return json({
      total,
      eligible,
      recentClicks: recentClicks.map((click) => ({
        id: click.id,
        occurredAt: click.occurredAt,
        isBot: click.isBot,
        isEligible: click.isEligible,
        invalidReason: click.invalidReason,
        creatorName: click.participant.creatorProfile.displayName,
        linkToken: click.trackingLink.token,
      })),
      byDate,
    });
  });
}
