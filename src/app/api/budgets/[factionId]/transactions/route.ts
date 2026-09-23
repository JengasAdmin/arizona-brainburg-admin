import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { getClientIp } from "@/server/http";
import { budgetTransactionSchema, createBudgetTransaction } from "@/server/services/budget";
import { departmentOfFaction } from "@/server/services/scope";

/**
 * POST /api/budgets/:factionId/transactions — deposit / withdrawal.
 * Requires MANAGE_BUDGET inside the faction's department scope.
 * Every operation writes an immutable ledger row + audit entry.
 */
export const POST = guard(
  {
    method: "POST",
    auth: true,
    permission: "MANAGE_BUDGET",
    schema: budgetTransactionSchema,
    rateLimit: { limit: 30, windowMs: 60_000 },
    scope: async ({ params }) => ({ departmentId: await departmentOfFaction(Number(params.factionId)) }),
  },
  async ({ params, body, auth, req }) => {
    const result = await createBudgetTransaction(Number(params.factionId), body, auth.actor, getClientIp(req));
    return NextResponse.json(result, { status: 201 });
  },
);
