import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/errors";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/v1/notifications/[notificationId]/read">,
) {
  return withApi(request, async () => {
    const { notificationId } = await ctx.params;
    const user = await requireUser();

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      throw notFound("Notification not found.");
    }
    if (notification.userId !== user.id) {
      throw forbidden("That notification does not belong to you.");
    }

    let updated = notification;
    if (!updated.readAt) {
      updated = await db.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return json({ notification: { id: updated.id, readAt: updated.readAt } });
  });
}
