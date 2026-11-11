import { db } from "@/lib/db";

export type NotificationInput = {
  userIds: string[];
  workspaceId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string;
  entityId?: string;
};

/** Create in-app notifications for the given users (deduplicated). */
export async function notify(input: NotificationInput): Promise<void> {
  const userIds = [...new Set(input.userIds)].filter(Boolean);
  if (userIds.length === 0) return;

  await db.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      workspaceId: input.workspaceId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  });
}

/** Notify every member of a workspace holding one of the given roles. */
export async function notifyWorkspace(
  workspaceId: string,
  roles: string[],
  input: Omit<NotificationInput, "userIds" | "workspaceId">,
): Promise<void> {
  const memberships = await db.membership.findMany({
    where: { workspaceId, role: { in: roles as never } },
    select: { userId: true },
  });
  await notify({
    ...input,
    workspaceId,
    userIds: memberships.map((m) => m.userId),
  });
}
