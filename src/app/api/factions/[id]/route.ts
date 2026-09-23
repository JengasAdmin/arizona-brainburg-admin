import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import {
  deleteFaction,
  getFactionDetail,
  updateFaction,
  updateFactionSchema,
} from "@/server/services/factions";
import { departmentOfFaction } from "@/server/services/scope";
import { RATE_LIMITS } from "@/server/security/rate-limit";

/** GET /api/factions/:id */
export const GET = guard(
  {
    method: "GET",
    auth: true,
    permission: "VIEW_FACTIONS",
    rateLimit: RATE_LIMITS.read,
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.id)) }),
  },
  async ({ params, auth }) => {
    return NextResponse.json(await getFactionDetail(Number(params.id), auth.actor));
  },
);

/** PATCH /api/factions/:id */
export const PATCH = guard(
  {
    method: "PATCH",
    auth: true,
    permission: "EDIT_FACTION",
    schema: updateFactionSchema,
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.id)) }),
  },
  async ({ params, body, auth, req }) => {
    const result = await updateFaction(Number(params.id), body, auth.actor, getClientIp(req));
    return NextResponse.json({ faction: { id: result.id } });
  },
);

/** DELETE /api/factions/:id — requires DELETE_FACTION (critical permission). */
export const DELETE = guard(
  {
    method: "DELETE",
    auth: true,
    permission: "DELETE_FACTION",
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.id)) }),
  },
  async ({ params, auth, req }) => {
    return NextResponse.json(await deleteFaction(Number(params.id), auth.actor, getClientIp(req)));
  },
);
