import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/rbac/engine";

/**
 * Scope helpers — derive which department a request touches.
 * `null` scope = global operation (only global permission holders pass).
 */

async function firstDepartment(statement: ReturnType<typeof sql>): Promise<number | null> {
  const res = await db.execute(statement);
  const rows = (res as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  const value = rows[0]?.department_id;
  return typeof value === "number" ? value : null;
}

/** Department of a user's most recent active term (null = no faction). */
export async function departmentOfUser(userId: number): Promise<number | null> {
  return firstDepartment(sql`
    SELECT f.department_id
    FROM leadership_terms lt
    JOIN factions f ON f.id = lt.faction_id
    WHERE lt.user_id = ${userId} AND lt.status = 'active'
    ORDER BY lt.appointed_at DESC, lt.id DESC
    LIMIT 1
  `);
}

export async function departmentOfTerm(termId: number): Promise<number | null> {
  return firstDepartment(sql`
    SELECT f.department_id
    FROM leadership_terms lt
    JOIN factions f ON f.id = lt.faction_id
    WHERE lt.id = ${termId}
  `);
}

export async function departmentOfFaction(factionId: number): Promise<number | null> {
  return firstDepartment(sql`SELECT department_id FROM factions WHERE id = ${factionId}`);
}

export async function departmentOfBudgetAccount(factionId: number): Promise<number | null> {
  return departmentOfFaction(factionId);
}

/**
 * Departments an actor may see rows for.
 * `null` ⇒ global (no filtering). `[]` ⇒ nothing (scoped role without departments).
 */
export function actorScope(actor: Actor): number[] | null {
  if (actor.roles.some((role) => role.key === "site_founder")) return null;
  if (actor.roles.some((role) => role.departmentId === null)) return null;
  const ids = actor.roles
    .map((role) => role.departmentId)
    .filter((id): id is number => typeof id === "number");
  return ids.length > 0 ? [...new Set(ids)] : [];
}
