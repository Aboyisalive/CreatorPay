import { json, withApi } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/logging";
import { paymentsConfig } from "@/lib/payments/config";
import { verifySignature } from "@/lib/payments/forge-webhook";

/**
 * Inbound Forge (Xtradot Bank sandbox) webhook receiver.
 *
 * Guide section 5.6: headers `x-forge-event`, `x-forge-timestamp`,
 * `x-forge-signature: sha256=<hex HMAC-SHA256 of "{timestamp}.{raw_body}">`.
 * Reject timestamps older than 5 minutes, de-duplicate on `event_id`, answer
 * 2xx within 10 s (failures retry at 1m, 5m, 15m, 1h, 6h).
 *
 * Raw-first: the verified event is stored before any handling. Payout state is
 * not driven from the payload (shape beyond event names is unprinted in the
 * guide); `transfer.*` events only prompt the polling reconciler, which asks
 * the bank for the truth by `reference`.
 */

export async function POST(request: Request) {
  return withApi(request, async () => {
    const secret = paymentsConfig().forgeWebhookSecret;
    const rawBody = await request.text();
    const timestamp = request.headers.get("x-forge-timestamp") ?? "";
    const signature = request.headers.get("x-forge-signature") ?? "";
    const eventName = request.headers.get("x-forge-event") ?? "unknown";

    if (!secret || !verifySignature(rawBody, timestamp, signature, secret)) {
      log("warn", "forge.webhook.rejected", { event: eventName });
      return json({ error: "invalid signature" }, 401);
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const eventId = typeof parsed.event_id === "string" ? parsed.event_id : null;
    const dedupeKey = `forge:${eventId ?? `${timestamp}:${signature}`}`;

    const existing = await db.webhookEvent.findUnique({ where: { dedupeKey } });
    if (existing) {
      return json({ received: true, duplicate: true });
    }

    await db.webhookEvent.create({
      data: {
        dedupeKey,
        rawBody: parsed as never,
        rawHeaders: Object.fromEntries(request.headers.entries()),
        processedAt: new Date(),
      },
    });
    log("info", "forge.webhook.received", { event: eventName, event_id: eventId });
    return json({ received: true });
  });
}
