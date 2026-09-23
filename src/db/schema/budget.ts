import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { factions } from "./factions";
import { users } from "./users";

/**
 * One budget account per faction. The balance is ONLY ever changed through a
 * budget transaction written in the same DB transaction (row-locked).
 */
export const budgetAccounts = pgTable(
  "budget_accounts",
  {
    id: serial("id").primaryKey(),
    factionId: integer("faction_id")
      .notNull()
      .references(() => factions.id, { onDelete: "cascade" })
      .unique(),
    /** Current balance in whole currency units. */
    balance: bigint("balance", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("budget_accounts_faction_uq").on(t.factionId)],
);

/** Immutable ledger — `balance_after = balance_before + amount` always holds. */
export const budgetTransactions = pgTable(
  "budget_transactions",
  {
    id: serial("id").primaryKey(), // Operation ID
    accountId: integer("account_id")
      .notNull()
      .references(() => budgetAccounts.id, { onDelete: "restrict" }),
    factionId: integer("faction_id")
      .notNull()
      .references(() => factions.id, { onDelete: "restrict" }),
    /** Signed amount: positive = deposit, negative = withdrawal. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** deposit | withdrawal */
    type: text("type").notNull(),
    balanceBefore: bigint("balance_before", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("budget_transactions_faction_idx").on(t.factionId),
    index("budget_transactions_account_idx").on(t.accountId),
    index("budget_transactions_created_idx").on(t.createdAt),
  ],
);
