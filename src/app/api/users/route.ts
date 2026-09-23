import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { validate } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { listUsers, userQuerySchema } from "@/server/services/users";

/** GET /api/users?q=&status=&roleId=&factionId=&kind=&page= */
export const GET = guard(
  {
    method: "GET",
    auth: true,
    permission: "VIEW_USERS",
    rateLimit: RATE_LIMITS.read,
  },
  async ({ req, auth }) => {
    const query = validate(userQuerySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    const result = await listUsers(query, auth.actor);
    return NextResponse.json(result);
  },
);
