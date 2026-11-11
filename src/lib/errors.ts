export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

export const unauthorized = (message = "Sign in to continue.") =>
  new ApiError(401, "unauthorized", message);

export const forbidden = (message = "You do not have permission to do that.") =>
  new ApiError(403, "forbidden", message);

export const notFound = (message = "Not found.") =>
  new ApiError(404, "not_found", message);

export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, "conflict", message, details);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "bad_request", message, details);

export const rateLimited = (retryAfterSeconds: number, message = "Too many requests. Please slow down.") =>
  new ApiError(429, "rate_limited", message, { retry_after: retryAfterSeconds }, { "Retry-After": String(retryAfterSeconds) });
