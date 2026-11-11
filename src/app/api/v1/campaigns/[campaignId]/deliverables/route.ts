import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound, badRequest } from "@/lib/errors";
import { createDeliverableSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/deliverables">,
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

    const deliverables = await db.deliverableRequirement.findMany({
      where: { campaignId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { submissions: true } } },
    });

    return json({ deliverables });
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/campaigns/[campaignId]/deliverables">,
) {
  return withApi(request, async () => {
    const { campaignId } = await ctx.params;
    const user = await requireUser();
    const input = createDeliverableSchema.parse(await readJson(request));

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { workspace: true },
    });
    if (!campaign) {
      throw notFound("Campaign not found.");
    }

    const context = await requireWorkspace(user, campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (campaign.status === "ARCHIVED") {
      throw badRequest("Cannot add deliverables to an archived campaign.");
    }

    const deliverable = await db.deliverableRequirement.create({
      data: {
        campaignId,
        name: input.name,
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        evidenceType: input.evidenceType,
        dueAt: input.dueAt,
      },
    });

    await recordAudit({
      workspaceId: campaign.workspaceId,
      actorUserId: user.id,
      action: "deliverable.created",
      entityType: "DeliverableRequirement",
      entityId: deliverable.id,
      metadata: { campaignId, name: input.name, type: input.type },
    });

    return json({ deliverable }, 201);
  });
}
