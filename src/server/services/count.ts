import "server-only";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Minimal executor interface satisfied by both the pool and transaction clients. */
type Exec = { execute: (statement: SQL) => Promise<unknown> };

/** Safe `SELECT count(*)` helper — works with the pool and inside transactions. */
export async function countOf(executor: Exec, statement: SQL): Promise<number> {
  const res = await executor.execute(statement);
  const rows = (res as { rows?: Record<string, unknown>[] }).rows ?? [];
  const value = rows[0]?.count;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export async function countRows(statement: SQL): Promise<number> {
  return countOf(db, statement);
}

export function tableCount(table: string, where?: SQL): SQL {
  return where
    ? sql`SELECT count(*) AS count FROM ${sql.raw(table)} WHERE ${where}`
    : sql`SELECT count(*) AS count FROM ${sql.raw(table)}`;
}

export const TRUE = sql`TRUE`;
