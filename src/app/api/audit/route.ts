import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { errors, validate } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { auditQuerySchema, listAudit } from "@/server/services/audit";
import { actorScope } from "@/server/services/scope";

/** GET /api/audit — immutable audit log (scope-filtered for specialized supervisors). */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_AUDIT_LOGS", rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const query = validate(auditQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    if (query.page < 1) throw errors.validation([{ path: "page", message: "Invalid page." }]);
    const result = await listAudit(query, actorScope(auth.actor));
    return NextResponse.json(result);
  },
);
