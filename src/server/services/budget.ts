import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { budgetAccounts, budgetTransactions, factions } from "@/db/schema";
import { errors } from "@/server/http";
import type { Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { actorScope, departmentOfFaction } from "./scope";
import { getSetting } from "./settings";
import { countOf } from "./count";
import { sql } from "drizzle-orm";

export interface BudgetAccountItem {
  factionId: number;
  factionName: string;
  factionShort: string;
  departmentId: number;
  balance: number;
}

export interface BudgetTransactionItem {
  id: number;
  factionId: number;
  factionName: string;
  amount: number;
  type: string;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  actorName: string | null;
  createdAt: string;
}

export async function listBudgets(actor: Actor): Promise<BudgetAccountItem[]> {
  const scope = actorScope(actor);
  const scopeCond = scope === null ? sql`TRUE` : sql`f.department_id = ANY(${scope})`;
  const res = await db.execute(sql`
    SELECT f.id AS faction_id, f.name, f.short_name, f.department_id,
           COALESCE(ba.balance, 0) AS balance
    FROM factions f
    LEFT JOIN budget_accounts ba ON ba.faction_id = f.id
    WHERE ${scopeCond}
    ORDER BY f.name
  `);
  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    factionId: r.faction_id as number,
    factionName: r.name as string,
    factionShort: r.short_name as string,
    departmentId: r.department_id as number,
    balance: (r.balance as number) ?? 0,
  }));
}

export async function getBudgetDetail(factionId: number, actor: Actor, page = 1, pageSize = 25) {
  const scope = actorScope(actor);
  const factionRows = await db.select().from(factions).where(eq(factions.id, factionId)).limit(1);
  const faction = factionRows[0];
  if (!faction) throw errors.notFound("Faction not found.");
  if (scope !== null && !scope.includes(faction.departmentId)) {
    throw errors.forbidden("This faction is outside your scope.", "OUT_OF_SCOPE");
  }

  const accountRows = await db
    .select()
    .from(budgetAccounts)
    .where(eq(budgetAccounts.factionId, factionId))
    .limit(1);
  const balance = accountRows[0]?.balance ?? 0;

  const total = await countOf(
    db,
    sql`SELECT count(*) AS count FROM budget_transactions WHERE faction_id = ${factionId}`,
  );

  const txRows = await db
    .select({
      id: budgetTransactions.id,
      factionId: budgetTransactions.factionId,
      factionName: factions.name,
      amount: budgetTransactions.amount,
      type: budgetTransactions.type,
      balanceBefore: budgetTransactions.balanceBefore,
      balanceAfter: budgetTransactions.balanceAfter,
      reason: budgetTransactions.reason,
      createdAt: budgetTransactions.createdAt,
    })
    .from(budgetTransactions)
    .innerJoin(factions, eq(factions.id, budgetTransactions.factionId))
    .where(eq(budgetTransactions.factionId, factionId))
    .orderBy(desc(budgetTransactions.createdAt), desc(budgetTransactions.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    factionId,
    factionName: faction.name,
    factionShort: faction.shortName,
    departmentId: faction.departmentId,
    balance,
    transactions: txRows.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })) as Omit<BudgetTransactionItem, "actorName">[],
    total,
    page,
    pageSize,
  };
}

export const budgetTransactionSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.coerce
    .number()
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero.")
    .max(1_000_000_000, "Amount is too large."),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Creates a budget transaction atomically:
 *   lock account row → verify → write ledger entry → update balance.
 * The Current Balance can NEVER change without a corresponding transaction.
 */
export async function createBudgetTransaction(
  factionId: number,
  input: z.infer<typeof budgetTransactionSchema>,
  actor: Actor,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const factionRows = await tx.select().from(factions).where(eq(factions.id, factionId));
    const faction = factionRows[0];
    if (!faction) throw errors.notFound("Faction not found.");

    // Ensure the account exists (older factions may predate the budget module).
    let accountRows = await tx
      .select()
      .from(budgetAccounts)
      .where(eq(budgetAccounts.factionId, factionId))
      .for("update");
    if (!accountRows[0]) {
      const created = await tx
        .insert(budgetAccounts)
        .values({ factionId, balance: 0 })
        .returning();
      accountRows = created;
    }
    const account = accountRows[0]!;

    const balanceBefore = account.balance;
    const signedAmount = input.type === "deposit" ? input.amount : -input.amount;
    const balanceAfter = balanceBefore + signedAmount;

    if (balanceAfter < 0) {
      const allowNegative = await getSetting<boolean>("allow_negative_budget");
      if (!allowNegative) {
        throw errors.conflict(
          `Insufficient balance: $${balanceBefore.toLocaleString("en-US")} cannot cover a withdrawal of $${input.amount.toLocaleString("en-US")}.`,
          "INSUFFICIENT_BALANCE",
        );
      }
    }

    const inserted = await tx
      .insert(budgetTransactions)
      .values({
        accountId: account.id,
        factionId,
        amount: signedAmount,
        type: input.type,
        balanceBefore,
        balanceAfter,
        reason: input.reason,
        actorId: actor.userId,
      })
      .returning();

    await tx
      .update(budgetAccounts)
      .set({ balance: balanceAfter, updatedAt: new Date() })
      .where(eq(budgetAccounts.id, account.id));

    await writeAudit({
      actorId: actor.userId,
      actorRole: actor.roles[0]?.name ?? null,
      action: input.type === "deposit" ? "BUDGET_DEPOSIT" : "BUDGET_WITHDRAWAL",
      entityType: "budget_transaction",
      entityId: inserted[0]!.id,
      targetLabel: faction.name,
      oldValue: { balance: balanceBefore },
      newValue: { balance: balanceAfter, amount: signedAmount },
      reason: input.reason,
      ip,
      departmentId: faction.departmentId,
    });

    return {
      operationId: inserted[0]!.id,
      factionId,
      amount: signedAmount,
      type: input.type,
      balanceBefore,
      balanceAfter,
      reason: input.reason,
      createdAt: inserted[0]!.createdAt.toISOString(),
    };
  });
}

export async function listAllTransactions(
  actor: Actor,
  opts: { page: number; pageSize: number; factionId?: number },
) {
  const scope = actorScope(actor);
  const conditions = [sql`TRUE`];
  if (scope !== null) conditions.push(sql`f.department_id = ANY(${scope})`);
  if (opts.factionId) conditions.push(sql`bt.faction_id = ${opts.factionId}`);
  const where = sql.join(conditions, sql` AND `);

  const total = await countOf(
    db,
    sql`SELECT count(*) AS count FROM budget_transactions bt JOIN factions f ON f.id = bt.faction_id WHERE ${where}`,
  );

  const res = await db.execute(sql`
    SELECT bt.id, bt.faction_id, f.name AS faction_name, bt.amount, bt.type,
           bt.balance_before, bt.balance_after, bt.reason, bt.created_at,
           u.display_name AS actor_name
    FROM budget_transactions bt
    JOIN factions f ON f.id = bt.faction_id
    LEFT JOIN users u ON u.id = bt.actor_id
    WHERE ${where}
    ORDER BY bt.created_at DESC, bt.id DESC
    LIMIT ${opts.pageSize} OFFSET ${(opts.page - 1) * opts.pageSize}
  `);

  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];

  return {
    items: rows.map((r) => ({
      id: r.id as number,
      factionId: r.faction_id as number,
      factionName: r.faction_name as string,
      amount: r.amount as number,
      type: r.type as string,
      balanceBefore: r.balance_before as number,
      balanceAfter: r.balance_after as number,
      reason: r.reason as string,
      actorName: (r.actor_name as string | null) ?? null,
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export { departmentOfFaction };
