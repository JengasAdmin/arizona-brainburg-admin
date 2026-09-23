import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import type { ZodTypeAny, z } from "zod";
import { errors, errorResponse, parseJsonBody } from "./http";
import { getAuth, type AuthContext } from "./auth/access";
import { can, type Scope } from "@/lib/rbac/engine";
import { rateLimit, RATE_LIMITS } from "./security/rate-limit";
import { getClientIp } from "./http";

export { errors };

export interface GuardContext<TBody> {
  req: NextRequest;
  auth: AuthContext;
  body: TBody;
  params: Record<string, string>;
  scope: Scope;
}

export interface GuardConfig<TSchema> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Default true — every guarded route requires a valid session. */
  auth?: boolean;
  /** Server-side permission check (403 when missing). */
  permission?: Parameters<typeof can>[1];
  /** Resolve the department scope of the request (specialized supervisors). */
  scope?: (args: {
    req: NextRequest;
    params: Record<string, string>;
    auth: AuthContext;
    body: TSchema;
  }) => Promise<Scope> | Scope;
  /** Validated JSON body schema. */
  schema?: ZodTypeAny & { _output?: TSchema };
  rateLimit?: { limit: number; windowMs: number };
}

/**
 * Every API route goes through `guard()`:
 *   rate limit → method → authentication → scope → permission → body validation → handler.
 * All checks happen on the SERVER. Missing permission ⇒ 403, never a hidden button.
 */
export function guard<S extends ZodTypeAny = ZodTypeAny>(
  config: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    auth?: boolean;
    permission?: Parameters<typeof can>[1];
    scope?: (args: {
      req: NextRequest;
      params: Record<string, string>;
      auth: AuthContext;
      body: z.infer<S>;
    }) => Promise<Scope> | Scope;
    schema?: S;
    rateLimit?: { limit: number; windowMs: number };
  },
  handler: (ctx: {
    req: NextRequest;
    auth: AuthContext;
    body: z.infer<S>;
    params: Record<string, string>;
    scope: Scope;
  }) => Promise<NextResponse> | NextResponse,
) {
  return async (
    req: NextRequest,
    // Next.js always invokes route handlers with a context object; the runtime
    // fallback below keeps direct invocation (tests) safe.
    routeParams: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    try {
      if (config.method && req.method !== config.method) {
        throw errors.forbidden(`Method ${req.method} not allowed.`, "METHOD_NOT_ALLOWED");
      }

      const rl = config.rateLimit ?? RATE_LIMITS.write;
      const limit = rateLimit(`${getClientIp(req)}:${req.nextUrl.pathname}`, rl.limit, rl.windowMs);
      if (!limit.ok) throw errors.rateLimited(limit.retryAfterSec);

      const params = routeParams ? await routeParams.params : {};

      const needsAuth = config.auth !== false;
      let auth: AuthContext | null = null;
      if (needsAuth || config.permission) {
        auth = await getAuth();
        if (needsAuth && !auth) throw errors.unauthorized();
        if (auth && auth.actor.status === "blocked") throw errors.forbidden("Account blocked.", "ACCOUNT_BLOCKED");
      }

      // Body validation runs BEFORE scope resolution so scope helpers may use it.
      let body = undefined as z.infer<S>;
      if (config.schema) {
        body = await parseJsonBody(req, config.schema);
      }

      let scope: Scope = {};
      if (auth && config.scope) {
        scope = (await config.scope({ req, params, auth, body })) ?? {};
      }

      if (config.permission && auth) {
        const decision = can(auth.actor, config.permission, scope);
        if (!decision.allowed) {
          throw errors.forbidden(
            `Missing permission: ${config.permission}.`,
            decision.reason ?? "FORBIDDEN",
          );
        }
      }

      return await handler({ req, auth: auth as AuthContext, body, params, scope });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
