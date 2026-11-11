export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code = "request_failed",
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | {
        error?: { code?: string; message?: string; details?: unknown };
      }
    | T
    | null;

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string; details?: unknown } })
      ?.error;
    throw new ApiClientError(
      error?.message ?? "Request failed. Please try again.",
      response.status,
      error?.code ?? "request_failed",
      error?.details,
    );
  }

  return body as T;
}

export function validationIssues(error: unknown): string[] {
  if (error instanceof ApiClientError) {
    if (Array.isArray(error.details)) {
      return error.details.map((item) => {
        if (item && typeof item === "object" && "message" in item) {
          return String((item as { message: unknown }).message);
        }
        return String(item);
      });
    }
    if (
      error.details &&
      typeof error.details === "object" &&
      "issues" in error.details &&
      Array.isArray((error.details as { issues: unknown }).issues)
    ) {
      return (error.details as { issues: unknown[] }).issues.map((issue) =>
        String(issue),
      );
    }
  }
  return [];
}
