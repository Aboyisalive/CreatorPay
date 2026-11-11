import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { updateCampaignSchema } from "@/lib/validation";
import {
  buildTermsSnapshot,
  normalizeRewardRules,
  type NormalizedRewardRule,
} from "@/lib/campaigns";
import { parseNairaToMinorDecimal } from "@/lib/money-server";
import { loadCampaignDetail } from "@/lib/campaign-view";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]">,
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

    const context = await requireWorkspace(user, campaign.workspaceId);
    const detail = await loadCampaignDetail(campaignId, context.workspace.id);

    return json({ workspace: context.workspace, role: context.role, ...detail });
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();

    const existing = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        currentTermVersion: {
          include: { rewardRules: { orderBy: { createdAt: "asc" } } },
        },
      },
    });
    if (!existing) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, existing.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (existing.status !== "DRAFT") {
      throw conflict(
        "Published campaigns cannot be edited in place. Term changes require a new version.",
      );
    }

    if (!existing.currentTermVersion) {
      throw badRequest("Campaign has no draft term version.");
    }

    const input = updateCampaignSchema.parse(await readJson(request));

    const rules: NormalizedRewardRule[] = input.rewardRules
      ? normalizeRewardRules(input.rewardRules)
      : existing.currentTermVersion.rewardRules.map((rule) => ({
          name: rule.name,
          type: "PER_EVENT" as const,
          eventType: rule.eventType!,
          amountMinor: rule.amountMinor,
          maxCount: rule.maxCount,
          capMinor: rule.capMinor,
        }));

    const merged = {
      id: existing.id,
      name: input.name ?? existing.name,
      summary:
        input.summary !== undefined ? input.summary : existing.summary,
      description:
        input.description !== undefined
          ? input.description
          : existing.description,
      objectives: input.objectives ?? existing.objectives,
      participationMode:
        input.participationMode ?? existing.participationMode,
      attributionModel: existing.attributionModel,
      attributionWindowDays:
        input.attributionWindowDays ?? existing.attributionWindowDays,
      destinationUrl: input.destinationUrl ?? existing.destinationUrl,
      startAt:
        input.startAt !== undefined
          ? input.startAt
            ? new Date(input.startAt)
            : null
          : existing.startAt,
      endAt:
        input.endAt !== undefined
          ? input.endAt
            ? new Date(input.endAt)
            : null
          : existing.endAt,
      budgetMinor:
        input.budgetNaira !== undefined
          ? parseNairaToMinorDecimal(input.budgetNaira)
          : existing.budgetMinor,
      currency: existing.currency,
    };

    const snapshot = buildTermsSnapshot(merged, rules);

    await db.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: existing.id },
        data: {
          name: merged.name,
          summary: merged.summary,
          description: merged.description,
          objectives: merged.objectives,
          participationMode: merged.participationMode,
          attributionWindowDays: merged.attributionWindowDays,
          destinationUrl: merged.destinationUrl,
          startAt: merged.startAt,
          endAt: merged.endAt,
          budgetMinor: merged.budgetMinor,
        },
      });

      await tx.rewardRule.deleteMany({
        where: { termVersionId: existing.currentTermVersion!.id },
      });

      await tx.rewardRule.createMany({
        data: rules.map((rule) => ({
          termVersionId: existing.currentTermVersion!.id,
          type: rule.type,
          name: rule.name,
          eventType: rule.eventType,
          amountMinor: rule.amountMinor,
          maxCount: rule.maxCount,
          capMinor: rule.capMinor,
        })),
      });

      await tx.campaignTermVersion.update({
        where: { id: existing.currentTermVersion!.id },
        data: { snapshot },
      });
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "campaign.draft_updated",
      entityType: "Campaign",
      entityId: existing.id,
    });

    const detail = await loadCampaignDetail(campaignId, context.workspace.id);
    return json({ campaign: detail.campaign });
  });
}
