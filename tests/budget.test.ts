import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/rbac/engine";

/* ---------------------------------- mocks ---------------------------------- */

const state = vi.hoisted(() => ({
  faction: { id: 1, name: "LSPD", shortName: "LSPD", departmentId: 1, allowMultipleLeaders: true } as
    | { id: number; name: string; shortName: string; departmentId: number; allowMultipleLeaders: boolean }
    | null,
  accounts: new Map<number, { id: number; factionId: number; balance: number }>(),
  transactions: [] as Record<string, unknown>[],
  allowNegativeBudget: false,
  audits: [] as Record<string, unknown>[],
  nextAccountId: 1,
  nextTxId: 1,
}));

vi.mock("@/server/services/audit", () => ({
  writeAudit: vi.fn(async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  }),
}));

vi.mock("@/server/services/settings", () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === "allow_negative_budget") return state.allowNegativeBudget;
    return null;
  }),
}));

vi.mock("@/server/services/count", () => ({
  countOf: vi.fn(async () => 0),
}));

vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");

  function thenable(rows: unknown[]) {
    return {
      for: () => thenable(rows),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected: (reason: unknown) => unknown,
      ) => Promise.resolve(rows).then(onFulfilled, onRejected),
    };
  }

  function rowsFor(table: unknown): unknown[] {
    if (table === schema.factions) return state.faction ? [{ ...state.faction }] : [];
    if (table === schema.budgetAccounts) {
      return [...state.accounts.values()];
    }
    return [];
  }

  const db = {
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeTx()),
  };

  function makeTx() {
    return {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            // Budget account lookups are filtered by faction in the real query;
            // the mock returns all accounts and the service filters with limit(1)+for("update").
            if (table === schema.budgetAccounts) {
              return {
                for: () => thenable([...state.accounts.values()]),
                limit: () => thenable([...state.accounts.values()]),
                then: (
                  f: (v: unknown) => unknown,
                  r: (e: unknown) => unknown,
                ) => Promise.resolve([...state.accounts.values()]).then(f, r),
              };
            }
            if (table === schema.factions) {
              const rows = state.faction ? [{ ...state.faction }] : [];
              return {
                limit: () => thenable(rows),
                then: (
                  f: (v: unknown) => unknown,
                  r: (e: unknown) => unknown,
                ) => Promise.resolve(rows).then(f, r),
              };
            }
            return thenable(rowsFor(table));
          },
          limit: () => thenable(rowsFor(table)),
          for: () => thenable(rowsFor(table)),
          then: (
            f: (v: unknown) => unknown,
            r: (e: unknown) => unknown,
          ) => Promise.resolve(rowsFor(table)).then(f, r),
        }),
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => {
            if (table === schema.budgetTransactions) {
              const row = {
                id: state.nextTxId++,
                createdAt: new Date("2026-09-23T12:00:00Z"),
                ...values,
              };
              state.transactions.push(row);
              return Promise.resolve([row]);
            }
            if (table === schema.budgetAccounts) {
              const row = { id: state.nextAccountId++, ...values };
              state.accounts.set(values.factionId as number, row as never);
              return Promise.resolve([row]);
            }
            return Promise.resolve([{ ...values }]);
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            if (table === schema.budgetAccounts) {
              const account = [...state.accounts.values()][0];
              if (account && typeof values.balance === "number") {
                account.balance = values.balance;
              }
            }
            return Promise.resolve([]);
          },
        }),
      }),
    };
  }

  return { db, pool: {} };
});

import { createBudgetTransaction, budgetTransactionSchema } from "@/server/services/budget";

const actor: Actor = { userId: 1, status: "active", roles: [] };
const input = (over: Partial<{ type: "deposit" | "withdrawal"; amount: number; reason: string }> = {}) => ({
  type: "deposit" as const,
  amount: 100,
  reason: "Monthly funding",
  ...over,
});

beforeEach(() => {
  state.faction = { id: 1, name: "LSPD", shortName: "LSPD", departmentId: 1, allowMultipleLeaders: true };
  state.accounts.clear();
  state.transactions = [];
  state.audits = [];
  state.allowNegativeBudget = false;
  state.nextAccountId = 1;
  state.nextTxId = 1;
  state.accounts.set(1, { id: 1, factionId: 1, balance: 1000 });
});

describe("budgetTransactionSchema", () => {
  it("accepts a valid deposit", () => {
    expect(budgetTransactionSchema.safeParse(input()).success).toBe(true);
  });

  it("rejects unknown types, zero/negative/fractional amounts and short reasons", () => {
    expect(budgetTransactionSchema.safeParse({ type: "transfer", amount: 10, reason: "ok ok" }).success).toBe(false);
    expect(budgetTransactionSchema.safeParse(input({ amount: 0 })).success).toBe(false);
    expect(budgetTransactionSchema.safeParse(input({ amount: -50 })).success).toBe(false);
    expect(budgetTransactionSchema.safeParse(input({ amount: 10.5 })).success).toBe(false);
    expect(budgetTransactionSchema.safeParse(input({ amount: 2_000_000_000 })).success).toBe(false);
    expect(budgetTransactionSchema.safeParse(input({ reason: "ab" })).success).toBe(false);
  });
});

describe("createBudgetTransaction — ledger math", () => {
  it("deposit increases the balance and writes a signed ledger entry", async () => {
    const result = await createBudgetTransaction(1, input({ type: "deposit", amount: 500 }), actor, "1.2.3.4");
    expect(result.balanceBefore).toBe(1000);
    expect(result.balanceAfter).toBe(1500);
    expect(result.amount).toBe(500);
    expect(state.accounts.get(1)!.balance).toBe(1500);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0]).toMatchObject({
      amount: 500,
      balanceBefore: 1000,
      balanceAfter: 1500,
      type: "deposit",
    });
  });

  it("withdrawal decreases the balance and stores a negative amount", async () => {
    const result = await createBudgetTransaction(
      1,
      input({ type: "withdrawal", amount: 300, reason: "Equipment purchase" }),
      actor,
      null,
    );
    expect(result.balanceBefore).toBe(1000);
    expect(result.balanceAfter).toBe(700);
    expect(result.amount).toBe(-300);
    expect(state.accounts.get(1)!.balance).toBe(700);
    expect(state.transactions[0]).toMatchObject({ amount: -300, balanceBefore: 1000, balanceAfter: 700 });
  });

  it("rejects a withdrawal that exceeds the balance — nothing is written (409 INSUFFICIENT_BALANCE)", async () => {
    await expect(
      createBudgetTransaction(1, input({ type: "withdrawal", amount: 5000, reason: "Too much" }), actor, null),
    ).rejects.toMatchObject({ status: 409, code: "INSUFFICIENT_BALANCE" });
    expect(state.transactions).toHaveLength(0);
    expect(state.accounts.get(1)!.balance).toBe(1000);
    expect(state.audits).toHaveLength(0);
  });

  it("allows a negative balance only when the allow_negative_budget setting is on", async () => {
    state.allowNegativeBudget = true;
    const result = await createBudgetTransaction(
      1,
      input({ type: "withdrawal", amount: 5000, reason: "Approved overdraft" }),
      actor,
      null,
    );
    expect(result.balanceAfter).toBe(-4000);
    expect(state.accounts.get(1)!.balance).toBe(-4000);
  });

  it("balance always equals the sum of all ledger entries (derived invariant)", async () => {
    await createBudgetTransaction(1, input({ type: "deposit", amount: 250 }), actor, null);
    await createBudgetTransaction(1, input({ type: "deposit", amount: 75, reason: "Donation" }), actor, null);
    await createBudgetTransaction(1, input({ type: "withdrawal", amount: 100, reason: "Repairs" }), actor, null);
    const ledgerSum = state.transactions.reduce((sum, t) => sum + (t.amount as number), 0);
    expect(state.accounts.get(1)!.balance).toBe(1000 + ledgerSum);
    expect(ledgerSum).toBe(225);
  });

  it("each entry stores a consistent before/after chain", async () => {
    await createBudgetTransaction(1, input({ type: "deposit", amount: 100 }), actor, null);
    await createBudgetTransaction(1, input({ type: "withdrawal", amount: 40, reason: "Taxi fare" }), actor, null);
    const [first, second] = state.transactions;
    expect(first.balanceAfter).toBe(1100);
    expect(second.balanceBefore).toBe(first.balanceAfter);
    expect(second.balanceAfter).toBe(1060);
  });

  it("writes an immutable audit entry for every transaction", async () => {
    await createBudgetTransaction(1, input({ type: "deposit", amount: 10 }), actor, "9.9.9.9");
    await createBudgetTransaction(1, input({ type: "withdrawal", amount: 10, reason: "Minor cost" }), actor, null);
    expect(state.audits.map((a) => a.action)).toEqual(["BUDGET_DEPOSIT", "BUDGET_WITHDRAWAL"]);
    expect(state.audits[0]).toMatchObject({
      actorId: 1,
      entityType: "budget_transaction",
      oldValue: { balance: 1000 },
      newValue: { balance: 1010, amount: 10 },
    });
  });

  it("throws 404 for a missing faction", async () => {
    state.faction = null;
    await expect(createBudgetTransaction(999, input(), actor, null)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(state.transactions).toHaveLength(0);
    expect(state.audits).toHaveLength(0);
  });
});
