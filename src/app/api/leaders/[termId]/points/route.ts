import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { adjustPoints, pointsSchema } from "@/server/services/leadership";
import { departmentOfTerm } from "@/server/services/scope";

/** POST /api/leaders/:termId/points — add/remove leadership points (reason required). */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "EDIT_LEADER_POINTS",
    schema: pointsSchema,
    scope: async ({ params }) => ({ departmentId: await departmentOfTerm(Number(params.termId)) }),
  },
  async ({ params, body, auth, req }) => {
    const result = await adjustPoints(Number(params.termId), body, auth.actor, getClientIp(req));
    return NextResponse.json(result);
  },
);
