import { db } from "@/lib/db";
import { json, parsePagination, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const { take, skip } = parsePagination(url.searchParams);
    const filter = url.searchParams.get("filter"); // "unread" | null

    const where = {
      userId: user.id,
      ...(filter === "unread" ? { readAt: null } : {}),
    };

    const [notifications, total, unread] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        entityType: n.entityType,
        entityId: n.entityId,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      total,
      unread,
      take,
      skip,
    });
  });
}
