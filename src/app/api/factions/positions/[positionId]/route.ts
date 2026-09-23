import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { updatePosition, updatePositionSchema } from "@/server/services/factions";
import { departmentOfFaction } from "@/server/services/scope";
import { db } from "@/db";
import { factionPositions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errors } from "@/server/http";

/** PATCH /api/factions/positions/:positionId — rename/reconfigure a position. */
export const PATCH = guard(
  {
    method: "PATCH",
    auth: true,
    permission: "EDIT_FACTION",
    schema: updatePositionSchema,
    scope: async ({ params }) => {
      const rows = await db
        .select({ factionId: factionPositions.factionId })
        .from(factionPositions)
        .where(eq(factionPositions.id, Number(params.positionId)))
        .limit(1);
      if (!rows[0]) throw errors.notFound("Position not found.");
      return { departmentId: await departmentOfFaction(rows[0].factionId) };
    },
  },
  async ({ params, body, auth, req }) => {
    const result = await updatePosition(Number(params.positionId), body, auth.actor, getClientIp(req));
    return NextResponse.json(result);
  },
);
