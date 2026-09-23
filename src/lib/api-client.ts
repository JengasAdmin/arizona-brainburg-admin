"use client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  cache?: RequestCache;
}

/** Client-side API helper — parses the structured error envelope from the backend. */
export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: init.cache ?? "no-store",
    credentials: "same-origin",
  });

  if (res.status === 401) {
    // Session expired — send the visitor back to the sign-in landing page.
    if (typeof window !== "undefined" && !window.location.pathname.match(/^\/($|\?)/)) {
      window.location.assign("/?error=session_expired");
    }
    throw new ApiClientError(401, "SESSION_EXPIRED", "Your session has expired.");
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const envelope = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiClientError(
      res.status,
      envelope?.code ?? "ERROR",
      envelope?.message ?? `Request failed with status ${res.status}.`,
      envelope?.details,
    );
  }

  return payload as T;
}

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
