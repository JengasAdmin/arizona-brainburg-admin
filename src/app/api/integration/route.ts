import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { getIntegrationStatus } from "@/server/services/integration";

/** GET /api/integration — integration status for the future game bot/API. */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_INTEGRATION", rateLimit: RATE_LIMITS.read },
  async () => {
    return NextResponse.json(await getIntegrationStatus());
  },
);
