import { createHash } from "crypto";
import { json, withApi } from "@/lib/api";
import { db } from "@/lib/db";
import { log } from "@/lib/logging";
import { ingestDeposit, type DepositInput } from "@/lib/payments/funding";

/**
 * Inbound Ecobank webhook receiver.
 *
 * Raw-first, dedupe, then process (plan milestone 11). The route is public
 * (server-to-server, no session). Signature verification is a pass-through
 * TODO until Ecobank's webhook signing scheme is confirmed (plan section 15,
 * open question) -- until then we rely on idempotent ingest + dedupe so a
 * replayed or forged callback can never double-credit escrow.
 *
 * Every callback is stored verbatim (raw body + headers) before any handling,
 * so nothing is lost even when we cannot yet parse the payload shape.
 */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const rawBody = await request.text();
    const rawHeaders = Object.fromEntries(request.headers.entries());

    // Best-effort JSON parse; keep the raw string when it isn't JSON.
    let parsed: unknown = rawBody;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      // non-JSON payload -- store as-is.
    }

    const dedupeKey = deriveDedupeKey(rawHeaders, parsed, rawBody);

    // Raw-first store. A duplicate (same dedupeKey) short-circuits -- we already
    // have this event, so acknowledge and stop.
    const existing = await db.webhookEvent.findUnique({ where: { dedupeKey } });
    if (existing) {
      log("info", "webhook.duplicate", { dedupe_key: dedupeKey });
      return json({ received: true, duplicate: true });
    }

    const event = await db.webhookEvent.create({
      data: { dedupeKey, rawBody: parsed as never, rawHeaders },
    });

    // Process. On any error we keep the row (processedAt stays null) and still
    // acknowledge so the bank does not retry forever; the raw event stays
    // available for manual resolution.
    try {
      const deposit = await processEvent(parsed);
      await db.webhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
      return json({ received: true, depositId: deposit?.id ?? null });
    } catch (error) {
      log("error", "webhook.process_error", {
        webhook_event_id: event.id,
        dedupe_key: dedupeKey,
        error: String(error),
      });
      return json({ received: true });
    }
  });
}

/**
 * Turn a parsed webhook payload into a deposit and ingest it (idempotent).
 *
 * TODO(webhook-payload): the Ecobank webhook body shape is unconfirmed (plan
 * section 15). Until it is, we deliberately do NOT guess field names -- a wrong
 * guess could mis-route money. Map the confirmed fields onto DepositInput and
 * return it here; `ingestDeposit` handles dedupe + escrow crediting + matching.
 * Returning null means "stored, not yet actionable."
 */
async function processEvent(parsed: unknown): Promise<{ id: string } | null> {
  const input: DepositInput | null = parseDepositFromWebhook(parsed);
  if (!input) {
    log("info", "webhook.unparsed", { reason: "payload shape unconfirmed" });
    return null;
  }
  const deposit = await ingestDeposit(input);
  return { id: deposit.id };
}

/**
 * TODO(webhook-payload): implement once the payload shape is confirmed.
 * Expected to extract a unique bank reference, amount (minor), currency and
 * sender hint, and build the dedupeKey from the bank's event id.
 */
function parseDepositFromWebhook(parsed: unknown): DepositInput | null {
  void parsed;
  return null;
}

/**
 * Derive a stable dedupe key: prefer a bank/event id from headers, then the
 * body, then fall back to a hash of the raw body.
 */
function deriveDedupeKey(
  headers: Record<string, string>,
  parsed: unknown,
  rawBody: string,
): string {
  const headerKeys = [
    "x-ecobank-event-id",
    "x-webhook-id",
    "x-request-id",
    "ecobank-event-id",
  ];
  for (const name of headerKeys) {
    const value = headers[name];
    if (value) return `hdr:${value}`;
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const field of ["eventId", "event_id", "transactionReference", "id"]) {
      const value = record[field];
      if (typeof value === "string" && value) return `body:${field}:${value}`;
    }
  }

  return `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}
