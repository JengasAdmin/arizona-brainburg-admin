import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Database access — PostgreSQL via node-postgres + Drizzle ORM.
 * The connection string NEVER reaches the client: this module is server-only.
 *
 * The pool is created LAZILY (on first query) so that merely importing this
 * module — e.g. while `next build` collects page data — never throws when
 * DATABASE_URL is not present in the build environment. The configuration
 * error surfaces at first actual use instead.
 */
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Copy .env.example to .env.local.");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
}

const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function getPool(): Pool {
  globalForDb.__pgPool ??= createPool();
  return globalForDb.__pgPool;
}

/**
 * Transparent lazy proxy: drizzle stores this object and only touches it when
 * a query runs, which triggers the real pool creation exactly once (per process).
 */
export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    // drizzle() introspects `constructor` while building the driver — that must
    // not force pool creation (or throw) at import time during `next build`.
    if (prop === "constructor") return Pool;
    const real = getPool() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
  set(_target, prop, value) {
    (getPool() as unknown as Record<string | symbol, unknown>)[prop] = value;
    return true;
  },
  has(_target, prop) {
    return prop in (getPool() as unknown as object);
  },
});

/** `mode: "number"` is applied per-column (see schema) so BIGINT returns JS numbers. */
export const db = drizzle(pool, { schema });

export type Database = typeof db;
