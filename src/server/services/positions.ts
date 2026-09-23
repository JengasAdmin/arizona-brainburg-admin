import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/rbac/engine";
import { actorScope } from "./scope";

/** Flat position option used by the appoint forms (leader/deputy positions). */
export interface PositionOption {
  id: number;
  factionId: number;
  factionName: string;
  factionShort: string;
  title: string;
  /** leader | deputy */
  kind: string;
  /** active | inactive */
  status: string;
}

/**
 * All faction positions the actor may see (scope-filtered), joined with their
 * faction so the client can render a faction → position picker without extra
 * round-trips. There is no GET endpoint that lists positions across factions.
 */
export async function listPositionOptions(actor: Actor): Promise<PositionOption[]> {
  const scope = actorScope(actor);
  const scopeCond = scope === null ? sql`TRUE` : sql`f.department_id = ANY(${scope})`;
  const res = await db.execute(sql`
    SELECT fp.id, fp.faction_id, f.name AS faction_name, f.short_name,
           fp.title, fp.kind, fp.status
    FROM faction_positions fp
    JOIN factions f ON f.id = fp.faction_id
    WHERE ${scopeCond}
    ORDER BY f.name ASC, fp.sort_order ASC, fp.title ASC
  `);

  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    id: r.id as number,
    factionId: r.faction_id as number,
    factionName: r.faction_name as string,
    factionShort: r.short_name as string,
    title: r.title as string,
    kind: r.kind as string,
    status: r.status as string,
  }));
}
