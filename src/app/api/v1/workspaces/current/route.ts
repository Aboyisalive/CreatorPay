import { db } from "@/lib/db";
import { json, readJson, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, CAMPAIGN_MANAGERS } from "@/lib/rbac";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";

const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  currency: z.string().trim().length(3).optional(),
});

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const context = await requireWorkspace(user);

    const membership = await db.membership.findFirst({
      where: { userId: user.id, workspaceId: context.workspace.id },
      select: { role: true },
    });

    return json({
      workspace: context.workspace,
      role: membership?.role ?? context.role,
    });
  });
}

export async function PATCH(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const input = updateWorkspaceSchema.parse(await readJson(request));
    const context = await requireWorkspace(user);
    assertRole(context.role, CAMPAIGN_MANAGERS);

    const updated = await db.workspace.update({
      where: { id: context.workspace.id },
      data: {
        name: input.name,
        currency: input.currency?.toUpperCase(),
      },
    });

    await recordAudit({
      workspaceId: updated.id,
      actorUserId: user.id,
      action: "workspace.updated",
      entityType: "Workspace",
      entityId: updated.id,
      metadata: { changes: input },
    });

    return json({ workspace: updated });
  });
}
