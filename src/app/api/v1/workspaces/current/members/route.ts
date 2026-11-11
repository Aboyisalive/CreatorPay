import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, ALL_ROLES } from "@/lib/rbac";

export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const context = await requireWorkspace(user);
    assertRole(context.role, ALL_ROLES);

    const memberships = await db.membership.findMany({
      where: { workspaceId: context.workspace.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return json({
      members: memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
    });
  });
}
