import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/errors";
import { serialize } from "@/lib/money";
import { currentRequestId, log, runWithRequestContext } from "@/lib/logging";

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(serialize(data), {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

/**
 * The origin users reach the app on. Behind a proxy `request.url` carries the
 * in-cluster host (http://0.0.0.0:8080), so prefer APP_URL, then forwarded
 * headers, then the request URL.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = request.headers.get("x-forwarded-host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

function requestPath(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function errorResponse(error: unknown, requestId: string): NextResponse {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          request_id: requestId,
        },
      },
      error.status,
      error.headers,
    );
  }

  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: "validation_error",
          message: "Some fields need attention.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
          request_id: requestId,
        },
      },
      422,
    );
  }

  return json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
        request_id: requestId,
      },
    },
    500,
  );
}

/**
 * Run an API handler with a correlation ID, structured request logging, and a
 * consistent error envelope. Every response (success or error) carries the same
 * `request_id` that is written to the server log line, so an operator can trace
 * a client-side failure straight back to its logs.
 */
export async function withApi(
  request: Request,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const method = request.method;
  const path = requestPath(request);
  const startedAt = Date.now();

  try {
    const response = await runWithRequestContext({ requestId }, handler);
    response.headers.set("x-request-id", requestId);
    log("info", "request", {
      request_id: requestId,
      method,
      path,
      status: response.status,
      duration_ms: Date.now() - startedAt,
    });
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const response = errorResponse(error, currentRequestId() ?? requestId);
    response.headers.set("x-request-id", response.headers.get("x-request-id") ?? requestId);

    if (error instanceof ApiError) {
      log(response.status >= 500 ? "error" : "warn", "request_failed", {
        request_id: response.headers.get("x-request-id"),
        method,
        path,
        status: response.status,
        code: error.code,
        duration_ms: durationMs,
      });
    } else if (error instanceof ZodError) {
      log("warn", "request_failed", {
        request_id: response.headers.get("x-request-id"),
        method,
        path,
        status: response.status,
        code: "validation_error",
        duration_ms: durationMs,
      });
    } else {
      log("error", "request_failed", {
        request_id: response.headers.get("x-request-id"),
        method,
        path,
        status: 500,
        code: "internal_error",
        duration_ms: durationMs,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    return response;
  }
}

export function parsePagination(searchParams: URLSearchParams): {
  take: number;
  skip: number;
} {
  const take = Math.min(
    Math.max(Number(searchParams.get("take") ?? 50) || 50, 1),
    200,
  );
  const skip = Math.max(Number(searchParams.get("skip") ?? 0) || 0, 0);
  return { take, skip };
}
