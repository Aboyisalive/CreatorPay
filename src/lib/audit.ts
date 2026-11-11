import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type AuditInput = {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await db.auditEvent.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? {},
    },
  });
}
