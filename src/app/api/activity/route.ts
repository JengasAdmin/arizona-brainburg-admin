import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { validate } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { activityQuerySchema, createActivity, createActivitySchema, listActivity } from "@/server/services/activity";

/** GET /api/activity — manual + future integration game activity. */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_ACTIVITY", rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const query = validate(activityQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    return NextResponse.json(await listActivity(query, auth.actor));
  },
);

/** POST /api/activity — create a manual game activity record. */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "CREATE_GAME_ACTIVITY",
    schema: createActivitySchema,
  },
  async ({ body, auth, req }) => {
    const result = await createActivity(body, auth.actor, getClientIpFrom(req));
    return NextResponse.json(result, { status: 201 });
  },
);

function getClientIpFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
