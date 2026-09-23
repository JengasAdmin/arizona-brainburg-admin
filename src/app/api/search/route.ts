import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { errors } from "@/server/http";
import { globalSearch } from "@/server/services/search";
import { RATE_LIMITS } from "@/server/security/rate-limit";

/** GET /api/search?q=… — global search (users, factions, positions). */
export const GET = guard(
  { method: "GET", auth: true, rateLimit: RATE_LIMITS.search },
  async ({ req, auth }) => {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (q.length > 120) throw errors.validation([{ path: "q", message: "Query too long." }]);
    const results = await globalSearch(q, auth.actor);
    return NextResponse.json(results);
  },
);
