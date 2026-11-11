import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { FINANCE_ROLES } from "@/lib/rbac";
import { ZERO_MINOR } from "@/lib/money-server";

/**
 * Workspace-wide operations summary for the business dashboard: work queues
 * (submissions to review, unmatched deposits, rewards awaiting approval) and
 * per-campaign telemetry. Money is only counted from each participant's
 * latest reward version so recalculations never double-count.
 */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const context = await requireWorkspace(user);
    const workspaceId = context.workspace.id;
    const canSeeFinance = FINANCE_ROLES.includes(context.role);

    const campaigns = await db.campaign.findMany({
      where: { workspaceId },
      select: { id: true, status: true },
    });
    const campaignIds = campaigns.map((campaign) => campaign.id);

    const [
      pendingSubmissions,
      participantsByStatus,
      clicksByCampaign,
      eligibleClicksByCampaign,
      verifiedEventsByCampaign,
      rewards,
      unmatchedDeposits,
    ] = await Promise.all([
      db.submission.count({
        where: {
          campaignId: { in: campaignIds },
          status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        },
      }),
      db.campaignParticipant.groupBy({
        by: ["status"],
        where: { campaignId: { in: campaignIds } },
        _count: { _all: true },
      }),
      db.clickEvent.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds } },
        _count: { _all: true },
      }),
      db.clickEvent.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: campaignIds }, isEligible: true },
        _count: { _all: true },
      }),
      db.conversionEvent.groupBy({
        by: ["campaignId"],
        where: {
          campaignId: { in: campaignIds },
          isTest: false,
          verificationStatus: "VERIFIED",
        },
        _count: { _all: true },
      }),
      db.rewardCalculation.findMany({
        where: { campaignId: { in: campaignIds } },
        orderBy: [{ participantId: "asc" }, { version: "desc" }],
        select: {
          participantId: true,
          campaignId: true,
          status: true,
          totalMinor: true,
        },
      }),
      canSeeFinance
        ? db.deposit.findMany({
            // Unmatched credits carry no campaign yet, so (as in
            // GET /payments/deposits?state=UNMATCHED) finance sees the shared queue.
            where: { state: "UNMATCHED" },
            select: { amountMinor: true },
          })
        : Promise.resolve([]),
    ]);

    const latest = new Map<string, (typeof rewards)[number]>();
    for (const reward of rewards) {
      if (!latest.has(reward.participantId)) {
        latest.set(reward.participantId, reward);
      }
    }

    let awaitingApprovalCount = 0;
    let awaitingApprovalMinor = ZERO_MINOR;
    let payableMinor = ZERO_MINOR;
    let paidMinor = ZERO_MINOR;
    for (const reward of latest.values()) {
      if (reward.status === "CALCULATED" || reward.status === "PENDING_REVIEW") {
        awaitingApprovalCount += 1;
        awaitingApprovalMinor = awaitingApprovalMinor.plus(reward.totalMinor);
      }
      if (reward.status === "APPROVED" || reward.status === "PAYABLE") {
        payableMinor = payableMinor.plus(reward.totalMinor);
      }
      if (reward.status === "PAID") {
        paidMinor = paidMinor.plus(reward.totalMinor);
      }
    }

    const countMap = (rows: { campaignId: string; _count: { _all: number } }[]) =>
      Object.fromEntries(rows.map((row) => [row.campaignId, row._count._all]));
    const clicks = countMap(clicksByCampaign);
    const eligibleClicks = countMap(eligibleClicksByCampaign);
    const verifiedEvents = countMap(verifiedEventsByCampaign);

    const participantCounts = Object.fromEntries(
      participantsByStatus.map((row) => [row.status, row._count._all]),
    );

    return json({
      role: context.role,
      queues: {
        submissionsToReview: pendingSubmissions,
        unmatchedDeposits: canSeeFinance
          ? {
              count: unmatchedDeposits.length,
              totalMinor: unmatchedDeposits.reduce(
                (sum, deposit) => sum.plus(deposit.amountMinor),
                ZERO_MINOR,
              ),
            }
          : null,
        rewardsAwaitingApproval: {
          count: awaitingApprovalCount,
          totalMinor: awaitingApprovalMinor,
        },
      },
      totals: {
        activeCampaigns: campaigns.filter((c) => c.status === "PUBLISHED").length,
        creators: Object.values(participantCounts).reduce((a, b) => a + b, 0),
        activeCreators: participantCounts.ACTIVE ?? 0,
        clicks: Object.values(clicks).reduce((a, b) => a + b, 0),
        eligibleClicks: Object.values(eligibleClicks).reduce((a, b) => a + b, 0),
        verifiedEvents: Object.values(verifiedEvents).reduce((a, b) => a + b, 0),
        payableMinor,
        paidMinor,
      },
      campaigns: Object.fromEntries(
        campaignIds.map((id) => [
          id,
          {
            clicks: clicks[id] ?? 0,
            eligibleClicks: eligibleClicks[id] ?? 0,
            verifiedEvents: verifiedEvents[id] ?? 0,
          },
        ]),
      ),
    });
  });
}
