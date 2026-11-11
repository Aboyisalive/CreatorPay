import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { conflict, notFound } from "@/lib/errors";
import { calculateReward } from "@/lib/rewards";
import { recordAudit } from "@/lib/audit";
import { ZERO_MINOR } from "@/lib/money-server";

const LOCKED_STATUSES = [
  "APPROVED",
  "PAYABLE",
  "PAYMENT_INITIATED",
  "PAID",
  "DISPUTED",
] as const;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/rewards/calculate">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        currentTermVersion: {
          include: { rewardRules: { orderBy: { createdAt: "asc" } } },
        },
        participants: {
          where: { status: { in: ["ACTIVE", "COMPLETED"] } },
          include: {
            conversionEvents: {
              where: {
                verificationStatus: "VERIFIED",
                eligibilityStatus: "ELIGIBLE",
                isTest: false,
              },
            },
            rewardCalculations: {
              orderBy: { version: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (!campaign.currentTermVersion?.publishedAt) {
      throw conflict("Publish the campaign before calculating rewards.");
    }

    const locked = campaign.participants
      .filter((participant) =>
        participant.rewardCalculations.some((reward) =>
          LOCKED_STATUSES.includes(
            reward.status as (typeof LOCKED_STATUSES)[number],
          ),
        ),
      )
      .map((participant) => participant.creatorProfileId);

    if (locked.length > 0) {
      throw conflict(
        "Some rewards are already approved. Create a documented adjustment instead of recalculating.",
        { lockedParticipantIds: locked },
      );
    }

    const rules = campaign.currentTermVersion.rewardRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      eventType: rule.eventType,
      amountMinor: rule.amountMinor,
      maxCount: rule.maxCount,
      capMinor: rule.capMinor,
    }));

    let remainingBudget = campaign.budgetMinor.gt(0) ? campaign.budgetMinor : null;

    const createdIds: string[] = [];

    for (const participant of campaign.participants) {
      if (participant.conversionEvents.length === 0) {
        continue;
      }

      const result = calculateReward({
        rules,
        events: participant.conversionEvents.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          occurredAt: event.occurredAt,
        })),
        budgetRemainingMinor: remainingBudget,
      });

      if (result.lines.length === 0) {
        continue;
      }

      const version =
        (participant.rewardCalculations[0]?.version ?? 0) + 1;

      const breakdown = {
        formula: "per-eligible-event",
        attributionModel: campaign.attributionModel,
        attributionWindowDays: campaign.attributionWindowDays,
        termVersion: campaign.currentTermVersion.version,
        countedEventIds: result.countedEventIds,
        rules: rules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          type: rule.type,
          eventType: rule.eventType,
          unitAmountMinor: rule.amountMinor.toString(),
          maxCount: rule.maxCount,
          capMinor: rule.capMinor?.toString() ?? null,
        })),
        budget: {
          budgetMinor: campaign.budgetMinor.toString(),
          unlimited: remainingBudget === null,
          remainingBeforeMinor: remainingBudget?.toString() ?? null,
        },
        calculatedAt: new Date().toISOString(),
      };

      const reward = await db.rewardCalculation.create({
        data: {
          campaignId: campaign.id,
          participantId: participant.id,
          termVersionId: campaign.currentTermVersion.id,
          version,
          status: "CALCULATED",
          currency: campaign.currency,
          totalMinor: result.totalMinor,
          breakdown,
          lines: {
            create: result.lines.map((line) => ({
              rewardRuleId: line.ruleId,
              conversionEventId: line.conversionEventId,
              type: line.type,
              description: line.description,
              quantity: line.quantity,
              unitAmountMinor: line.unitAmountMinor,
              amountMinor: line.amountMinor,
            })),
          },
        },
      });

      createdIds.push(reward.id);

      if (remainingBudget !== null) {
        remainingBudget = remainingBudget.minus(result.totalMinor);
        if (remainingBudget.lt(0)) {
          remainingBudget = ZERO_MINOR;
        }
      }
    }

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "rewards.calculated",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { created: createdIds.length, rewardIds: createdIds },
    });

    return json({
      created: createdIds.length,
      rewardIds: createdIds,
      message:
        createdIds.length === 0
          ? "No eligible events were available to reward."
          : "Rewards calculated. They still need review and approval.",
    });
  });
}
