import { NextResponse } from "next/server";
import { guard, errors } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { can } from "@/lib/rbac/engine";
import { addDisciplinary, disciplinarySchema } from "@/server/services/leadership";
import { departmentOfTerm } from "@/server/services/scope";

/**
 * POST /api/leaders/:termId/disciplinary — issue a warning or reprimand.
 * Permission: GIVE_WARNING / GIVE_REPRIMAND depending on the type.
 */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    schema: disciplinarySchema,
    scope: async ({ params }) => ({ departmentId: await departmentOfTerm(Number(params.termId)) }),
  },
  async ({ params, body, auth, req, scope }) => {
    const permission = body.type === "warning" ? "GIVE_WARNING" : "GIVE_REPRIMAND";
    const decision = can(auth.actor, permission, scope);
    if (!decision.allowed) {
      throw errors.forbidden(`Missing permission: ${permission}.`, decision.reason ?? "FORBIDDEN");
    }
    const result = await addDisciplinary(Number(params.termId), body, auth.actor, getClientIp(req));
    return NextResponse.json(result, { status: 201 });
  },
);
