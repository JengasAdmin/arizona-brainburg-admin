import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { listFactions } from "@/server/services/factions";
import { createFaction, createFactionSchema } from "@/server/services/factions";

/** GET /api/factions */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_FACTIONS", rateLimit: RATE_LIMITS.read },
  async ({ auth }) => {
    return NextResponse.json({ items: await listFactions(auth.actor) });
  },
);

/** POST /api/factions — create a faction (scoped to the actor's department). */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "CREATE_FACTION",
    schema: createFactionSchema,
    scope: async ({ body }) => ({ departmentId: body.departmentId ?? null }),
  },
  async ({ body, auth, req }) => {
    const result = await createFaction(body, auth.actor, getClientIpSafe(req));
    return NextResponse.json(result, { status: 201 });
  },
);

function getClientIpSafe(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
