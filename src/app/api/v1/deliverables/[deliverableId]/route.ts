import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { notFound, badRequest } from "@/lib/errors";
import { updateDeliverableSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/v1/deliverables/[deliverableId]">,
) {
  return withApi(request, async () => {
    const { deliverableId } = await ctx.params;
    const user = await requireUser();
    const input = updateDeliverableSchema.parse(await readJson(request));

    const deliverable = await db.deliverableRequirement.findUnique({
      where: { id: deliverableId },
      include: { campaign: { include: { workspace: true } } },
    });
    if (!deliverable) {
      throw notFound("Deliverable not found.");
    }

    const context = await requireWorkspace(user, deliverable.campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (deliverable.campaign.status === "ARCHIVED") {
      throw badRequest("Cannot edit deliverables on an archived campaign.");
    }

    const updated = await db.deliverableRequirement.update({
      where: { id: deliverableId },
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        evidenceType: input.evidenceType,
        dueAt: input.dueAt,
      },
    });

    await recordAudit({
      workspaceId: deliverable.campaign.workspaceId,
      actorUserId: user.id,
      action: "deliverable.updated",
      entityType: "DeliverableRequirement",
      entityId: deliverableId,
      metadata: { campaignId: deliverable.campaignId, changes: input },
    });

    return json({ deliverable: updated });
  });
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/v1/deliverables/[deliverableId]">,
) {
  return withApi(request, async () => {
    const { deliverableId } = await ctx.params;
    const user = await requireUser();

    const deliverable = await db.deliverableRequirement.findUnique({
      where: { id: deliverableId },
      include: {
        campaign: { include: { workspace: true } },
        _count: { select: { submissions: true } },
      },
    });
    if (!deliverable) {
      throw notFound("Deliverable not found.");
    }

    const context = await requireWorkspace(user, deliverable.campaign.workspaceId);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    if (deliverable._count.submissions > 0) {
      throw badRequest("Cannot delete a deliverable that has submissions.");
    }

    if (deliverable.campaign.status === "ARCHIVED") {
      throw badRequest("Cannot delete deliverables on an archived campaign.");
    }

    await db.deliverableRequirement.delete({ where: { id: deliverableId } });

    await recordAudit({
      workspaceId: deliverable.campaign.workspaceId,
      actorUserId: user.id,
      action: "deliverable.deleted",
      entityType: "DeliverableRequirement",
      entityId: deliverableId,
      metadata: { campaignId: deliverable.campaignId, name: deliverable.name },
    });

    return json({ ok: true });
  });
}
