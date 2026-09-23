import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/server/guard";
import { getAuth } from "@/server/auth/access";
import { actorFromRoles, authFromActor } from "./helpers";

vi.mock("@/server/auth/access", () => ({
  getAuth: vi.fn(),
}));

const getAuthMock = vi.mocked(getAuth);

/** Next.js always passes a route context; tests use this default. */
const CTX = { params: Promise.resolve({}) } as { params: Promise<Record<string, string>> };

function req(path: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const okHandler = vi.fn(() =>
  Response.json({ ok: true }) as unknown as ReturnType<typeof import("next/server").NextResponse.json>,
);

beforeEach(() => {
  getAuthMock.mockReset();
  okHandler.mockClear();
});

describe("guard() — authentication", () => {
  it("rejects wrong methods with 403 METHOD_NOT_ALLOWED", async () => {
    const route = guard({ method: "POST" }, okHandler);
    const res = await route(req("/api/guard-method", "GET"), CTX);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests with 401", async () => {
    getAuthMock.mockResolvedValue(null);
    const route = guard({ method: "GET", auth: true }, okHandler);
    const res = await route(req("/api/guard-unauth", "GET"), CTX);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("allows auth: false routes without a session", async () => {
    getAuthMock.mockResolvedValue(null);
    const route = guard({ auth: false }, okHandler);
    const res = await route(req("/api/guard-public", "GET"), CTX);
    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalled();
  });

  it("blocks suspended/blocked accounts with 403 ACCOUNT_BLOCKED", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"], "blocked")));
    const route = guard({ method: "GET" }, okHandler);
    const res = await route(req("/api/guard-blocked", "GET"), CTX);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("ACCOUNT_BLOCKED");
    expect(okHandler).not.toHaveBeenCalled();
  });
});

describe("guard() — permission enforcement (403s)", () => {
  it("returns 403 with the missing permission when the actor lacks it", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["player"])));
    const route = guard({ method: "GET", permission: "VIEW_AUDIT_LOGS" }, okHandler);
    const res = await route(req("/api/guard-403", "GET"), CTX);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toBe("Нет разрешения: VIEW_AUDIT_LOGS.");
    expect(body.error.code).toBe("MISSING_PERMISSION");
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("Administrator L3 cannot pass a MANAGE_ROLES gate", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["administrator_level_3"])));
    const route = guard({ method: "GET", permission: "MANAGE_ROLES" }, okHandler);
    const res = await route(req("/api/guard-l3", "GET"), CTX);
    expect(res.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("Founder passes every permission gate", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const route = guard({ method: "GET", permission: "SYSTEM_SETTINGS" }, okHandler);
    const res = await route(req("/api/guard-founder", "GET"), CTX);
    expect(res.status).toBe(200);
    expect(okHandler).toHaveBeenCalled();
  });

  it("specialized supervisor passes inside its scope and is denied outside it", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["sup_state_chief"])));

    const inScope = guard(
      { method: "GET", permission: "APPOINT_LEADER", scope: () => ({ departmentId: 1 }) },
      okHandler,
    );
    const ok = await inScope(req("/api/guard-scope-in", "GET"), CTX);
    expect(ok.status).toBe(200);

    const outOfScope = guard(
      { method: "GET", permission: "APPOINT_LEADER", scope: () => ({ departmentId: 4 }) },
      okHandler,
    );
    const denied = await outOfScope(req("/api/guard-scope-out", "GET"), CTX);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("MISSING_PERMISSION");
  });
});

describe("guard() — body validation and rate limiting", () => {
  it("validates the body before the handler (422 with field details)", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const route = guard(
      { method: "POST", schema: z.object({ reason: z.string().min(3) }) },
      okHandler,
    );
    const res = await route(req("/api/guard-body", "POST", { reason: "x" }), CTX);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([{ path: "reason", message: "Минимум 3 символов." }]);
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 422", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const route = guard({ method: "POST", schema: z.object({}) }, okHandler);
    const res = await route(
      new NextRequest("http://localhost/api/guard-json", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
      CTX,
    );
    expect(res.status).toBe(422);
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("enforces the rate limit with 429 and a Retry-After header", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const route = guard(
      { method: "GET", rateLimit: { limit: 1, windowMs: 60_000 } },
      okHandler,
    );
    const first = await route(req("/api/guard-rl", "GET"), CTX);
    expect(first.status).toBe(200);
    const second = await route(req("/api/guard-rl", "GET"), CTX);
    expect(second.status).toBe(429);
    expect((await second.json()).error.code).toBe("RATE_LIMITED");
    expect(second.headers.get("Retry-After")).toBeTruthy();
    expect(okHandler).toHaveBeenCalledTimes(1);
  });
});

describe("guard() — handler contract", () => {
  it("passes validated body, params, scope and auth to the handler", async () => {
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const seen: Record<string, unknown> = {};
    const route = guard(
      {
        method: "POST",
        schema: z.object({ reason: z.string().min(3) }),
        scope: () => ({ departmentId: 2 }),
      },
      async (ctx) => {
        seen.body = ctx.body;
        seen.params = ctx.params;
        seen.scope = ctx.scope;
        seen.userId = ctx.auth.actor.userId;
        return Response.json({ ok: true }) as unknown as ReturnType<
          typeof import("next/server").NextResponse.json
        >;
      },
    );
    const res = await route(
      req("/api/guard-ctx", "POST", { reason: "because" }),
      { params: Promise.resolve({ id: "42" }) },
    );
    expect(res.status).toBe(200);
    expect(seen.body).toEqual({ reason: "because" });
    expect(seen.params).toEqual({ id: "42" });
    expect(seen.scope).toEqual({ departmentId: 2 });
    expect(seen.userId).toBe(1);
  });

  it("never leaks internal errors — 500 with a generic message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getAuthMock.mockResolvedValue(authFromActor(actorFromRoles(["site_founder"])));
    const route = guard({ method: "GET" }, () => {
      throw new Error("secret internal detail");
    });
    const res = await route(req("/api/guard-500", "GET"), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Внутренняя ошибка сервера.");
    expect(JSON.stringify(body)).not.toContain("secret internal detail");
    vi.restoreAllMocks();
  });
});
