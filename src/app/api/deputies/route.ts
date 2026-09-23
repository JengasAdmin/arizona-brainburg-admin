import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { validate } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { listTerms, termQuerySchema } from "@/server/services/leadership";

/** GET /api/deputies — deputy terms (kind=deputy) with filters. */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_DEPUTIES", rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const query = validate(termQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    const result = await listTerms({ ...query, kind: "deputy" }, auth.actor);
    return NextResponse.json(result);
  },
);
