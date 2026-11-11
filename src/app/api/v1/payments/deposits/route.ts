import { db } from "@/lib/db";
import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";

/**
 * List deposits. `?state=UNMATCHED` returns the operator queue (unmatched
 * deposits have no campaign, so they are global); any other/absent state
 * returns this workspace's deposits.
 */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const context = await requireWorkspace(user, url.searchParams.get("workspaceId"));
    assertRole(context.role, FINANCE_ROLES);

    const state = url.searchParams.get("state");
    const where =
      state === "UNMATCHED"
        ? { state: "UNMATCHED" as const }
        : {
            ...(state ? { state: state as never } : {}),
            campaign: { workspaceId: context.workspace.id },
          };

    const deposits = await db.deposit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return json({ deposits });
  });
}
