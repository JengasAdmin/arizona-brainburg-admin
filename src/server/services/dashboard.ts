import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { Actor } from "@/lib/rbac/engine";
import { actorScope } from "./scope";
import { countOf } from "./count";
import { unreadCount } from "./notifications";

export interface DashboardStats {
  registeredUsers: number;
  onlineUsers: number;
  activeLeaders: number;
  activeDeputies: number;
  totalFactions: number;
  pendingActions: number;
  unreadNotifications: number;
}

export interface RecentActivityItem {
  id: number;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetLabel: string | null;
  reason: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
}

export async function getDashboard(actor: Actor): Promise<{
  stats: DashboardStats;
  recent: RecentActivityItem[];
}> {
  const scope = actorScope(actor);
  const scopeCond = scope === null ? sql`TRUE` : sql`f.department_id = ANY(${scope})`;
  const userScopeCond =
    scope === null
      ? sql`TRUE`
      : sql`EXISTS (SELECT 1 FROM leadership_terms lt JOIN factions f ON f.id = lt.faction_id
                     WHERE lt.user_id = u.id AND lt.status = 'active' AND f.department_id = ANY(${scope}))`;

  const registeredUsers = await countOf(db, sql`SELECT count(*) AS count FROM users`);

  const onlineUsers = await countOf(
    db,
    sql`SELECT count(*) AS count FROM users
        WHERE last_login_at > now() - interval '15 minutes' AND status = 'active'`,
  );

  const activeLeaders = await countOf(
    db,
    sql`SELECT count(*) AS count FROM leadership_terms lt
        JOIN faction_positions fp ON fp.id = lt.position_id
        JOIN factions f ON f.id = lt.faction_id
        WHERE lt.status = 'active' AND fp.kind = 'leader' AND ${scopeCond}`,
  );

  const activeDeputies = await countOf(
    db,
    sql`SELECT count(*) AS count FROM leadership_terms lt
        JOIN faction_positions fp ON fp.id = lt.position_id
        JOIN factions f ON f.id = lt.faction_id
        WHERE lt.status = 'active' AND fp.kind = 'deputy' AND ${scopeCond}`,
  );

  const totalFactions = await countOf(
    db,
    sql`SELECT count(*) AS count FROM factions f WHERE ${scopeCond} AND f.status = 'active'`,
  );

  // Pending actions: Game IDs waiting for verification inside the actor's scope.
  const pendingActions = await countOf(
    db,
    sql`SELECT count(*) AS count FROM users u
        WHERE u.game_id IS NOT NULL AND u.game_id_verified_at IS NULL AND u.status = 'active'
          AND ${userScopeCond}`,
  );

  const unreadNotifications = await unreadCount(actor.userId);

  const recentRes = await db.execute(sql`
    SELECT a.id, u.display_name AS actor_name, a.actor_role, a.action, a.target_label,
           a.reason, a.old_value, a.new_value, a.created_at
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    ${scope === null ? sql`` : sql`LEFT JOIN departments d ON d.id = a.department_id`}
    WHERE ${scope === null ? sql`TRUE` : sql`a.department_id = ANY(${scope})`}
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 12
  `);

  const rows = ((recentRes as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];

  return {
    stats: {
      registeredUsers,
      onlineUsers,
      activeLeaders,
      activeDeputies,
      totalFactions,
      pendingActions,
      unreadNotifications,
    },
    recent: rows.map((r) => ({
      id: r.id as number,
      actorName: (r.actor_name as string | null) ?? null,
      actorRole: (r.actor_role as string | null) ?? null,
      action: r.action as string,
      targetLabel: (r.target_label as string | null) ?? null,
      reason: (r.reason as string | null) ?? null,
      oldValue: r.old_value ?? null,
      newValue: r.new_value ?? null,
      createdAt: new Date(r.created_at as string).toISOString(),
    })),
  };
}
