import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

/** Structured API error — never leaks internals to the client. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const errors = {
  unauthorized: (message = "Authentication required.") => new ApiError(401, "UNAUTHENTICATED", message),
  sessionExpired: () => new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again."),
  forbidden: (message = "You do not have permission to perform this action.", code = "FORBIDDEN") =>
    new ApiError(403, code, message),
  notFound: (message = "Resource not found.") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string, code = "CONFLICT") => new ApiError(409, code, message),
  validation: (details?: unknown) =>
    new ApiError(422, "VALIDATION_ERROR", "The submitted data is invalid.", details),
  rateLimited: (retryAfterSec: number) =>
    // details carries the retry seconds — errorResponse() maps it to the Retry-After header.
    new ApiError(429, "RATE_LIMITED", `Too many requests. Retry in ${retryAfterSec}s.`, retryAfterSec),
  serviceUnavailable: (message: string, code = "SERVICE_UNAVAILABLE") =>
    new ApiError(503, code, message),
  internal: () => new ApiError(500, "INTERNAL_ERROR", "Internal server error."),
};

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function parseJsonBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw errors.validation({ _errors: ["Invalid JSON body."] });
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw errors.validation(zodDetails(result.error));
  return result.data as z.infer<S>;
}

export function validate<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw errors.validation(zodDetails(result.error));
  return result.data as z.infer<S>;
}

function zodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/** Convert any thrown value into a safe JSON response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      console.error("[api]", err.code, err.message);
    }
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.status, headers: err.status === 429 ? { "Retry-After": String((err.details as number) ?? 60) } : undefined },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "The submitted data is invalid.", details: zodDetails(err) } },
      { status: 422 },
    );
  }
  // Never expose stack traces or internal messages.
  console.error("[api] unhandled", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error.", details: null } },
    { status: 500 },
  );
}

export function queryInt(req: NextRequest, key: string, fallback: number): number {
  const raw = req.nextUrl.searchParams.get(key);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function queryString(req: NextRequest, key: string): string | null {
  return req.nextUrl.searchParams.get(key);
}
