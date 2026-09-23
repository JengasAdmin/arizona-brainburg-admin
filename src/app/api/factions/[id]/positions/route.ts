import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { createPosition, createPositionSchema } from "@/server/services/factions";
import { departmentOfFaction } from "@/server/services/scope";

/** POST /api/factions/:id/positions — add a named position (title stored as data). */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "EDIT_FACTION",
    schema: createPositionSchema,
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.id)) }),
  },
  async ({ params, body, auth, req }) => {
    const result = await createPosition(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json(result, { status: 201 });
  },
);
