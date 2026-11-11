import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Structured logging for the API.
 *
 * Every log line is a single JSON object written to stdout, so the platform
 * operator can pipe logs into any standard collector. Every line emitted while
 * handling a request carries the request's correlation ID (`request_id`), which
 * is the same ID returned in error responses, so a failed API call can be
 * traced straight back to its server log line.
 */

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  return LEVEL_ORDER[raw as Level] ?? LEVEL_ORDER.info;
}

export function log(level: Level, message: string, fields: Fields = {}): void {
  if (LEVEL_ORDER[level] < configuredLevel()) {
    return;
  }

  const line: Fields = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };

  // Never emit stack traces for expected client errors — only for 5xx.
  if (typeof line.error === "string") {
    line.error = sanitize(line.error);
  }

  const serialized = safeStringify(line);
  if (level === "error") {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

// Keep error text bounded so a runaway message cannot flood logs.
function sanitize(message: string): string {
  return message.length > 500 ? `${message.slice(0, 500)}…` : message;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, inner) =>
      typeof inner === "bigint" ? inner.toString() : inner,
    );
  } catch {
    return JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "unserializable log line" });
  }
}

/**
 * Correlation context for the request currently being handled. Everything
 * logged (or turned into an error response) inside `withApi` picks up the
 * active request ID automatically, so handlers never have to thread it through.
 */
type RequestContext = { requestId: string };

const requestContext = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
