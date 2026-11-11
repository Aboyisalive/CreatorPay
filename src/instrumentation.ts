/**
 * Settles in-flight payouts without a click: every RECONCILE_INTERVAL_MS
 * (default 20 s, 0 disables) ask the bank about payouts still pending.
 * Safe with several replicas: reconcilePayout claims each state change
 * atomically, so the ledger is posted once.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const raw = process.env.RECONCILE_INTERVAL_MS;
  const intervalMs = raw === undefined || raw === "" ? 20_000 : Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return;

  const { reconcileStalePayouts } = await import("@/lib/payments/payout");
  const { log } = await import("@/lib/logging");

  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const resolved = await reconcileStalePayouts();
      if (resolved > 0) log("info", "payout.auto_reconciled", { resolved });
    } catch (error) {
      log("warn", "payout.auto_reconcile_error", { error: String(error) });
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
}
