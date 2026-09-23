import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getDashboard } from "@/server/services/dashboard";
import { RATE_LIMITS } from "@/server/security/rate-limit";

/** GET /api/dashboard — statistics and recent activity (scope-filtered). */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_DASHBOARD", rateLimit: RATE_LIMITS.read },
  async ({ auth }) => {
    const data = await getDashboard(auth.actor);
    return NextResponse.json(data);
  },
);
