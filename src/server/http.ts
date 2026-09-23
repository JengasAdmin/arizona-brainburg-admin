import { NextRequest, NextResponse } from "next/server";
import { ZodError, z, type ZodTypeAny } from "zod";

/**
 * Русские сообщения zod по умолчанию. Кастомные сообщения схем имеют приоритет
 * (проверено: `errorMap` их не затирает).
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null") return { message: "Обязательное поле." };
      return { message: `Ожидается тип ${issue.expected}, получено ${issue.received}.` };
    case "too_small":
      if (issue.type === "string") return { message: `Минимум ${issue.minimum} символов.` };
      if (issue.type === "array") return { message: `Минимум ${issue.minimum} элементов.` };
      if (issue.type === "date") return { message: `Дата не раньше ${String(issue.minimum)}.` };
      return { message: `Значение не меньше ${String(issue.minimum)}.` };
    case "too_big":
      if (issue.type === "string") return { message: `Максимум ${issue.maximum} символов.` };
      if (issue.type === "array") return { message: `Максимум ${issue.maximum} элементов.` };
      if (issue.type === "date") return { message: `Дата не позже ${String(issue.maximum)}.` };
      return { message: `Значение не больше ${String(issue.maximum)}.` };
    case "invalid_enum_value":
      return { message: `Недопустимое значение. Допустимо: ${issue.options.join(", ")}.` };
    case "unrecognized_keys":
      return { message: `Лишние поля: ${issue.keys.join(", ")}.` };
    case "invalid_literal":
    case "invalid_union":
      return { message: "Недопустимое значение." };
    case "invalid_date":
      return { message: "Недопустимая дата." };
    default:
      return { message: ctx.defaultError };
  }
});

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
  unauthorized: (message = "Требуется вход в систему.") => new ApiError(401, "UNAUTHENTICATED", message),
  sessionExpired: () => new ApiError(401, "SESSION_EXPIRED", "Сессия истекла. Войдите заново."),
  forbidden: (message = "У вас нет прав для выполнения этого действия.", code = "FORBIDDEN") =>
    new ApiError(403, code, message),
  notFound: (message = "Ресурс не найден.") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string, code = "CONFLICT") => new ApiError(409, code, message),
  validation: (details?: unknown) =>
    new ApiError(422, "VALIDATION_ERROR", "Переданные данные некорректны.", details),
  rateLimited: (retryAfterSec: number) =>
    // details carries the retry seconds — errorResponse() maps it to the Retry-After header.
    new ApiError(429, "RATE_LIMITED", `Слишком много запросов. Повторите через ${retryAfterSec} с.`, retryAfterSec),
  serviceUnavailable: (message: string, code = "SERVICE_UNAVAILABLE") =>
    new ApiError(503, code, message),
  internal: () => new ApiError(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера."),
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
    throw errors.validation({ _errors: ["Некорректный JSON в теле запроса."] });
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
      { error: { code: "VALIDATION_ERROR", message: "Переданные данные некорректны.", details: zodDetails(err) } },
      { status: 422 },
    );
  }
  // Never expose stack traces or internal messages.
  console.error("[api] unhandled", err);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера.", details: null } },
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
