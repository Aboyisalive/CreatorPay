import { json, withApi } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { paymentsConfig } from "@/lib/payments/config";

/**
 * Which payment rail this deployment runs on, so the UI can label simulated
 * settlements honestly. Non-secret: provider + environment only.
 */
export async function GET(request: Request) {
  return withApi(request, async () => {
    await requireUser();
    const config = paymentsConfig();
    return json({
      rail: {
        provider: config.provider,
        environment: config.env,
        simulated: config.provider === "mock",
      },
    });
  });
}
