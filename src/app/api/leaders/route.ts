import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { guard, errors } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { can } from "@/lib/rbac/engine";
import { db } from "@/db";
import { factionPositions } from "@/db/schema";
import { appointTerm, appointSchema } from "@/server/services/leadership";
import { departmentOfFaction } from "@/server/services/scope";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { validate } from "@/server/http";
import { termQuerySchema, listTerms } from "@/server/services/leadership";

/** GET /api/leaders?status=active&factionId=&kind=leader|deputy&q=&page= */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_LEADERS", rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const query = validate(termQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    const result = await listTerms(query, auth.actor);
    return NextResponse.json(result);
  },
);

/**
 * POST /api/leaders — appoint a leader/deputy (always creates a NEW term).
 * Permission depends on the position kind:
 *   leader → APPOINT_LEADER, deputy → MANAGE_DEPUTIES
 */
export const POST = guard(
  { method: "POST", auth: true, schema: appointSchema, rateLimit: RATE_LIMITS.write },
  async ({ body, auth, req }) => {
    const positionRows = await db
      .select({ id: factionPositions.id, kind: factionPositions.kind, factionId: factionPositions.factionId })
      .from(factionPositions)
      .where(eq(factionPositions.id, body.positionId))
      .limit(1);
    if (!positionRows[0]) throw errors.notFound("Position not found.");

    const departmentId = await departmentOfFaction(positionRows[0].factionId);
    const permission = positionRows[0].kind === "deputy" ? "MANAGE_DEPUTIES" : "APPOINT_LEADER";
    const decision = can(auth.actor, permission, { departmentId });
    if (!decision.allowed) {
      throw errors.forbidden(`Missing permission: ${permission}.`, decision.reason ?? "FORBIDDEN");
    }

    const result = await appointTerm(body, auth.actor, getClientIp(req));
    return NextResponse.json(result, { status: 201 });
  },
);
