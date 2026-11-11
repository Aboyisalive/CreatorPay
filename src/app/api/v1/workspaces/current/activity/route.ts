import { db } from "@/lib/db";
import { json, parsePagination, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";

export async function GET(
  request: Request,
) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const { take, skip } = parsePagination(url.searchParams);

    const membership = await db.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!membership) {
      return json({ activities: [], total: 0, take, skip });
    }

    const context = await requireWorkspace(user, membership.workspaceId);

    const where = { workspaceId: context.workspace.id };

    const [events, total] = await Promise.all([
      db.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: { actor: { select: { name: true, email: true } } },
      }),
      db.auditEvent.count({ where }),
    ]);

    return json({
      activities: events.map((e) => ({
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: e.metadata,
        actor: e.actor ? { name: e.actor.name, email: e.actor.email } : null,
        createdAt: e.createdAt,
      })),
      total,
      take,
      skip,
    });
  });
}
