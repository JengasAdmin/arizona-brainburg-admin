import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getTerm } from "@/server/services/leadership";
import { departmentOfTerm } from "@/server/services/scope";
import { RATE_LIMITS } from "@/server/security/rate-limit";

/** GET /api/leaders/:termId */
export const GET = guard(
  {
    method: "GET",
    auth: true,
    permission: "VIEW_LEADERS",
    rateLimit: RATE_LIMITS.read,
    scope: async ({ params }) => ({ departmentId: await departmentOfTerm(Number(params.termId)) }),
  },
  async ({ params }) => {
    return NextResponse.json(await getTerm(Number(params.termId)));
  },
);
