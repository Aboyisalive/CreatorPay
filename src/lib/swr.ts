"use client";

import useSWR, { useSWRConfig, type SWRConfiguration } from "swr";
import { toast } from "sonner";
import { apiFetch, ApiClientError, validationIssues } from "@/lib/client-api";

export const fetcher = <T,>(path: string) => apiFetch<T>(path);

/** GET an API path with caching, focus revalidation and dedupe. `null` skips. */
export function useApiData<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, config);
}

export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof ApiClientError) {
    const issues = validationIssues(error);
    return issues.length ? `${error.message} ${issues.join(" ")}` : error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * Run a mutation, toast the outcome, then revalidate every cached key that
 * starts with one of `revalidate` prefixes.
 */
export function useMutation() {
  const { mutate } = useSWRConfig();

  return async function run<T>(
    request: () => Promise<T>,
    options: {
      success?: string | ((result: T) => string);
      revalidate?: string[];
      silent?: boolean;
    } = {},
  ): Promise<T | undefined> {
    try {
      const result = await request();
      if (options.success && !options.silent) {
        toast.success(
          typeof options.success === "function" ? options.success(result) : options.success,
        );
      }
      const prefixes = options.revalidate ?? [];
      await mutate(
        (key) => typeof key === "string" && prefixes.some((prefix) => key.startsWith(prefix)),
      );
      return result;
    } catch (caught) {
      toast.error(errorMessage(caught, "The action could not be completed."));
      return undefined;
    }
  };
}

export function post<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function send<T = unknown>(method: "PATCH" | "PUT" | "DELETE", path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
