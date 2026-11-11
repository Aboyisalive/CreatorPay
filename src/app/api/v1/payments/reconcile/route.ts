import { json, withApi } from "@/lib/api";
import { requireUser, requireWorkspace } from "@/lib/auth";
import { assertRole, FINANCE_ROLES } from "@/lib/rbac";
import { reconcileStalePayouts } from "@/lib/payments/payout";

/**
 * Reconciliation sweep: poll the provider for every PENDING payout with a
 * bankReference. Safe to call from a cron (idempotent). Finance only.
 */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const context = await requireWorkspace(user, url.searchParams.get("workspaceId"));
    assertRole(context.role, FINANCE_ROLES);

    const resolved = await reconcileStalePayouts();
    return json({ resolved });
  });
}
