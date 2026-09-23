import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/rbac/engine";
import { actorScope } from "./scope";

export interface SearchResults {
  users: {
    id: number;
    displayName: string;
    nickname: string | null;
    avatarUrl: string | null;
    gameId: string | null;
    faction: string | null;
  }[];
  factions: { id: number; name: string; shortName: string }[];
  positions: { id: number; title: string; kind: string; factionId: number; factionName: string }[];
}

/** Global search: nickname, Game ID, internal User ID, Discord/VK ID, faction, position. */
export async function globalSearch(query: string, actor: Actor): Promise<SearchResults> {
  const q = query.trim();
  if (q.length === 0) return { users: [], factions: [], positions: [] };
  const like = `%${q}%`;
  const scope = actorScope(actor);
  const scopeCond = scope === null ? sql`TRUE` : sql`f.department_id = ANY(${scope})`;

  const usersRes = await db.execute(sql`
    SELECT u.id, u.display_name, u.nickname, u.avatar_url, u.game_id,
           (SELECT f.name FROM leadership_terms lt JOIN factions f ON f.id = lt.faction_id
             WHERE lt.user_id = u.id AND lt.status = 'active'
             ORDER BY lt.appointed_at DESC LIMIT 1) AS faction_name
    FROM users u
    WHERE (
      u.display_name ILIKE ${like}
      OR u.nickname ILIKE ${like}
      OR u.id::text = ${q}
      OR u.game_id = ${q}
      OR EXISTS (SELECT 1 FROM oauth_accounts oa WHERE oa.user_id = u.id
                 AND (oa.provider_account_id = ${q} OR oa.provider_username ILIKE ${like}))
    )
    ORDER BY u.display_name
    LIMIT 8
  `);

  const factionsRes = await db.execute(sql`
    SELECT f.id, f.name, f.short_name
    FROM factions f
    WHERE (f.name ILIKE ${like} OR f.short_name ILIKE ${like} OR f.key ILIKE ${like})
      AND ${scopeCond}
    ORDER BY f.name
    LIMIT 6
  `);

  const positionsRes = await db.execute(sql`
    SELECT fp.id, fp.title, fp.kind, fp.faction_id, f.name AS faction_name
    FROM faction_positions fp
    JOIN factions f ON f.id = fp.faction_id
    WHERE fp.title ILIKE ${like} AND ${scopeCond}
    ORDER BY fp.title
    LIMIT 6
  `);

  const rowsOf = (res: unknown): Record<string, unknown>[] =>
    ((res as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];

  return {
    users: rowsOf(usersRes).map((r) => ({
      id: r.id as number,
      displayName: r.display_name as string,
      nickname: (r.nickname as string | null) ?? null,
      avatarUrl: (r.avatar_url as string | null) ?? null,
      gameId: (r.game_id as string | null) ?? null,
      faction: (r.faction_name as string | null) ?? null,
    })),
    factions: rowsOf(factionsRes).map((r) => ({
      id: r.id as number,
      name: r.name as string,
      shortName: r.short_name as string,
    })),
    positions: rowsOf(positionsRes).map((r) => ({
      id: r.id as number,
      title: r.title as string,
      kind: r.kind as string,
      factionId: r.faction_id as number,
      factionName: r.faction_name as string,
    })),
  };
}
