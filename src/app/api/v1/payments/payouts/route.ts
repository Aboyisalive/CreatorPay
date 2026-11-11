import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { listPayoutsForWorkspace } from "@/lib/payments/payout";

/** List a workspace's payouts, optionally filtered by `?state=PENDING`. */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const context = await requireWorkspace(user, url.searchParams.get("workspaceId"));
    assertRole(context.role, FINANCE_ROLES);

    const payouts = await listPayoutsForWorkspace(
      context.workspace.id,
      url.searchParams.get("state"),
    );

    return json({ payouts });
  });
}
