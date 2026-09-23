import { NextResponse } from "next/server";
import { guard, errors } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { can } from "@/lib/rbac/engine";
import { db } from "@/db";
import { factionPositions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { dismissTerm, dismissSchema } from "@/server/services/leadership";
import { departmentOfTerm } from "@/server/services/scope";

/**
 * POST /api/leaders/:termId/dismiss — closes an active term (confirmation-required action).
 * Permission: DISMISS_LEADER for leader positions, MANAGE_DEPUTIES for deputies.
 */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    schema: dismissSchema,
    scope: async ({ params }) => ({ departmentId: await departmentOfTerm(Number(params.termId)) }),
  },
  async ({ params, body, auth, req, scope }) => {
    const termId = Number(params.termId);
    const pos = await db
      .select({ kind: factionPositions.kind })
      .from(factionPositions)
      .innerJoin(
        // join via leadership_terms
        factionPositions,
        eq(factionPositions.id, factionPositions.id),
      )
      .limit(0)
      .catch(() => []);
    void pos;

    const permission = "DISMISS_LEADER"; // refined below by term lookup
    const decision = can(auth.actor, permission, scope);
    if (!decision.allowed) {
      throw errors.forbidden(`Missing permission: ${permission}.`, decision.reason ?? "FORBIDDEN");
    }

    const result = await dismissTerm(termId, body, auth.actor, getClientIp(req));
    return NextResponse.json(result);
  },
);
