import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { validate } from "@/server/http";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { getBudgetDetail } from "@/server/services/budget";
import { departmentOfFaction } from "@/server/services/scope";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/budgets/:factionId — balance + transaction history. */
export const GET = guard(
  {
    method: "GET",
    auth: true,
    permission: "VIEW_BUDGET",
    rateLimit: RATE_LIMITS.read,
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.factionId)) }),
  },
  async ({ params, req, auth }) => {
    const query = validate(querySchema, Object.fromEntries(req.nextUrl.searchParams.entries()));
    return NextResponse.json(await getBudgetDetail(Number(params.factionId), auth.actor, query.page, query.pageSize));
  },
);
