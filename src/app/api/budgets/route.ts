import { NextResponse } from "next/server";
import { guard } from "@/server/guard";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { listBudgets, listAllTransactions } from "@/server/services/budget";

/** GET /api/budgets — faction balances + optional global transaction feed. */
export const GET = guard(
  { method: "GET", auth: true, permission: "VIEW_BUDGET", rateLimit: RATE_LIMITS.read },
  async ({ req, auth }) => {
    const view = req.nextUrl.searchParams.get("view");
    if (view === "transactions") {
      const page = Number(req.nextUrl.searchParams.get("page") ?? "1") || 1;
      const pageSize = Math.min(Number(req.nextUrl.searchParams.get("pageSize") ?? "25") || 25, 100);
      const factionIdParam = req.nextUrl.searchParams.get("factionId");
      return NextResponse.json(
        await listAllTransactions(auth.actor, {
          page,
          pageSize,
          factionId: factionIdParam ? Number(factionIdParam) : undefined,
        }),
      );
    }
    return NextResponse.json({ items: await listBudgets(auth.actor) });
  },
);
