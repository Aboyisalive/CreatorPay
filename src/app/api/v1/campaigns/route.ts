import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { createCampaignSchema } from "@/lib/validation";
import {
  buildTermsSnapshot,
  normalizeRewardRules,
} from "@/lib/campaigns";
import { parseNairaToMinorDecimal } from "@/lib/money-server";
import { recordAudit } from "@/lib/audit";
import { listCampaignsForWorkspace } from "@/lib/campaign-view";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const context = await requireWorkspace(
      user,
      url.searchParams.get("workspaceId"),
    );

    const campaigns = await listCampaignsForWorkspace(context.workspace.id);

    return json({
      workspace: context.workspace,
      campaigns: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        summary: campaign.summary,
        status: campaign.status,
        fundingStatus: campaign.fundingStatus,
        objectives: campaign.objectives,
        participationMode: campaign.participationMode,
        attributionWindowDays: campaign.attributionWindowDays,
        budgetMinor: campaign.budgetMinor,
        currency: campaign.currency,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
        createdAt: campaign.createdAt,
        rewardRules: campaign.currentTermVersion?.rewardRules ?? [],
        counts: campaign._count,
      })),
    });
  });
}

export async function POST(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const context = await requireWorkspace(user);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    const input = createCampaignSchema.parse(await readJson(request));
    const rules = normalizeRewardRules(input.rewardRules);

    const campaign = await db.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          workspaceId: context.workspace.id,
          name: input.name,
          summary: input.summary ?? null,
          description: input.description ?? null,
          objectives: input.objectives,
          participationMode: input.participationMode,
          attributionWindowDays: input.attributionWindowDays,
          destinationUrl: input.destinationUrl,
          startAt: input.startAt ? new Date(input.startAt) : null,
          endAt: input.endAt ? new Date(input.endAt) : null,
          budgetMinor: parseNairaToMinorDecimal(input.budgetNaira),
          currency: context.workspace.currency,
          status: "DRAFT",
        },
      });

      const version = await tx.campaignTermVersion.create({
        data: {
          campaignId: created.id,
          version: 1,
          createdById: user.id,
          snapshot: {},
          rewardRules: {
            create: rules.map((rule) => ({
              type: rule.type,
              name: rule.name,
              eventType: rule.eventType,
              amountMinor: rule.amountMinor,
              maxCount: rule.maxCount,
              capMinor: rule.capMinor,
            })),
          },
        },
      });

      const snapshot = buildTermsSnapshot(created, rules);

      await tx.campaignTermVersion.update({
        where: { id: version.id },
        data: { snapshot },
      });

      return tx.campaign.update({
        where: { id: created.id },
        data: { currentTermVersionId: version.id },
        include: { currentTermVersion: { include: { rewardRules: true } } },
      });
    });

    await recordAudit({
      workspaceId: context.workspace.id,
      actorUserId: user.id,
      action: "campaign.created",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { name: campaign.name },
    });

    return json(
      {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          currentTermVersion: campaign.currentTermVersion,
        },
      },
      201,
    );
  });
}
