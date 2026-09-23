import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { oauthAccounts, roles, rolePermissions, userRoles, users } from "@/db/schema";
import { errors } from "@/server/http";
import { canAssignRole, canManageAdminUsers, isFounder, maxLevel, type Actor } from "@/lib/rbac/engine";
import { writeAudit } from "./audit";
import { notify } from "./notifications";
import { actorScope } from "./scope";

/* ---------------------------------- Types ---------------------------------- */

export interface UserListItem {
  id: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  gameId: string | null;
  gameIdVerified: boolean;
  status: string;
  branch: string | null;
  serverNumber: number;
  createdAt: string;
  lastLoginAt: string | null;
  roles: { key: string; name: string; level: number }[];
  faction: {
    termId: number;
    factionId: number;
    name: string;
    shortName: string;
    positionTitle: string;
    positionKind: string;
    departmentId: number;
    leadershipPoints: number;
    appointedAt: string;
  } | null;
}

export const userQuerySchema = z.object({
  q: z.string().max(120).optional(),
  status: z.enum(["active", "suspended", "blocked", "inactive"]).optional(),
  roleId: z.coerce.number().int().optional(),
  factionId: z.coerce.number().int().optional(),
  kind: z.enum(["leader", "deputy"]).optional(),
  unverifiedGameId: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type UserQuery = z.infer<typeof userQuerySchema>;

/* ---------------------------------- List ----------------------------------- */

export async function listUsers(query: UserQuery, actor: Actor): Promise<{
  items: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const scope = actorScope(actor);
  const conditions = [sql`TRUE`];

  if (scope !== null) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM leadership_terms lt2
      JOIN factions f2 ON f2.id = lt2.faction_id
      WHERE lt2.user_id = u.id AND lt2.status = 'active' AND f2.department_id = ANY(${scope})
    )`);
  }
  if (query.status) conditions.push(sql`u.status = ${query.status}`);
  if (query.factionId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM leadership_terms ltf
      WHERE ltf.user_id = u.id AND ltf.status = 'active' AND ltf.faction_id = ${query.factionId}
    )`);
  }
  if (query.roleId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM user_roles urf WHERE urf.user_id = u.id AND urf.role_id = ${query.roleId}
    )`);
  }
  if (query.kind) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM leadership_terms ltk
      JOIN faction_positions fpk ON fpk.id = ltk.position_id
      WHERE ltk.user_id = u.id AND ltk.status = 'active' AND fpk.kind = ${query.kind}
    )`);
  }
  if (query.unverifiedGameId) {
    conditions.push(sql`u.game_id IS NOT NULL AND u.game_id_verified_at IS NULL`);
  }
  if (query.q) {
    const like = `%${query.q}%`;
    conditions.push(sql`(
      u.display_name ILIKE ${like}
      OR u.nickname ILIKE ${like}
      OR u.id::text = ${query.q}
      OR u.game_id = ${query.q}
      OR EXISTS (
        SELECT 1 FROM oauth_accounts oa
        WHERE oa.user_id = u.id AND (oa.provider_account_id = ${query.q} OR oa.provider_username ILIKE ${like})
      )
    )`);
  }

  const where = sql.join(conditions, sql` AND `);

  const countRes = await db.execute<{ count: string }>(
    sql`SELECT count(*)::text AS count FROM users u WHERE ${where}`,
  );
  const total = Number(
    ((countRes as unknown as { rows?: { count: string }[] }).rows?.[0]?.count as string) ?? "0",
  );

  const offset = (query.page - 1) * query.pageSize;
  const res = await db.execute(sql`
    SELECT u.id, u.display_name, u.nickname, u.avatar_url, u.game_id, u.game_id_verified_at,
           u.status, u.branch, u.created_at, u.last_login_at, s.server_number,
           COALESCE((SELECT json_agg(json_build_object('key', r.key, 'name', r.name, 'level', r.level))
                     FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                     WHERE ur.user_id = u.id), '[]'::json) AS roles,
           ft.*
    FROM users u
    JOIN servers s ON s.id = u.server_id
    LEFT JOIN LATERAL (
      SELECT lt.id AS term_id, lt.faction_id, f.name AS faction_name, f.short_name,
             fp.title AS position_title, fp.kind AS position_kind, f.department_id,
             lt.leadership_points, lt.appointed_at
      FROM leadership_terms lt
      JOIN factions f ON f.id = lt.faction_id
      JOIN faction_positions fp ON fp.id = lt.position_id
      WHERE lt.user_id = u.id AND lt.status = 'active'
      ORDER BY lt.appointed_at DESC, lt.id DESC
      LIMIT 1
    ) ft ON true
    WHERE ${where}
    ORDER BY u.id DESC
    LIMIT ${query.pageSize} OFFSET ${offset}
  `);

  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];

  return {
    items: rows.map((r) => ({
      id: r.id as number,
      displayName: r.display_name as string,
      nickname: (r.nickname as string | null) ?? null,
      avatarUrl: (r.avatar_url as string | null) ?? null,
      gameId: (r.game_id as string | null) ?? null,
      gameIdVerified: Boolean(r.game_id_verified_at),
      status: r.status as string,
      branch: (r.branch as string | null) ?? null,
      serverNumber: r.server_number as number,
      createdAt: new Date(r.created_at as string).toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string).toISOString() : null,
      roles: (r.roles as { key: string; name: string; level: number }[]) ?? [],
      faction: r.term_id
        ? {
            termId: r.term_id as number,
            factionId: r.faction_id as number,
            name: r.faction_name as string,
            shortName: r.short_name as string,
            positionTitle: r.position_title as string,
            positionKind: r.position_kind as string,
            departmentId: r.department_id as number,
            leadershipPoints: (r.leadership_points as number) ?? 0,
            appointedAt: new Date(r.appointed_at as string).toISOString(),
          }
        : null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/* --------------------------------- Detail ---------------------------------- */

export async function getUserDetail(userId: number, actor: Actor) {
  const scope = actorScope(actor);
  if (scope !== null) {
    const inScope = await db.execute(sql`
      SELECT 1 FROM users u
      WHERE u.id = ${userId}
        AND (
          EXISTS (SELECT 1 FROM leadership_terms lt JOIN factions f ON f.id = lt.faction_id
                  WHERE lt.user_id = u.id AND lt.status = 'active' AND f.department_id = ANY(${scope}))
          OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                     WHERE ur.user_id = u.id AND r.department_id IS NULL AND r.level > 0)
        )
      LIMIT 1
    `);
    const rows = (inScope as unknown as { rows?: unknown[] }).rows ?? [];
    if (rows.length === 0) throw errors.forbidden("Пользователь вне вашей зоны доступа.", "OUT_OF_SCOPE");
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) throw errors.notFound("Пользователь не найден.");

  const roleRows = await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      level: roles.level,
      category: roles.category,
      departmentId: roles.departmentId,
      assignedAt: userRoles.createdAt,
      assignedBy: userRoles.assignedBy,
      permissions: sql<string[] | null>`array_agg(${rolePermissions.permissionKey})`,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .groupBy(roles.id, userRoles.createdAt, userRoles.assignedBy);

  const providerRows = await db
    .select()
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));

  const { tokenVersion: _tv, ...safeUser } = user;
  return {
    user: safeUser,
    roles: roleRows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      level: r.level,
      category: r.category,
      departmentId: r.departmentId,
      assignedAt: r.assignedAt.toISOString(),
      permissions: (r.permissions ?? []).filter((p): p is string => Boolean(p)),
    })),
    providers: providerRows.map((p) => ({
      provider: p.provider,
      username: p.providerUsername,
      displayName: p.providerDisplayName,
      avatarUrl: p.providerAvatarUrl,
      connectedAt: p.createdAt.toISOString(),
    })),
  };
}

// (end of file helpers are intentionally minimal)

/* ------------------------------- Profile edit ------------------------------ */

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(64).optional(),
  nickname: z.string().trim().max(64).nullable().optional(),
  branch: z.string().trim().max(120).nullable().optional(),
  gameId: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z_-]{1,32}$/, "Game ID должен содержать 1-32 буквенно-цифровых символа.")
    .nullable()
    .optional(),
});

export const setStatusSchema = z.object({
  status: z.enum(["active", "suspended", "blocked", "inactive"]),
  reason: z.string().trim().min(3).max(500),
});

export const verifyGameIdSchema = z.object({
  verified: z.boolean(),
  reason: z.string().trim().min(3).max(500).optional(),
});

export async function updateProfile(
  userId: number,
  patch: z.infer<typeof updateProfileSchema>,
  actor: Actor,
  ip: string | null,
) {
  const before = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!before[0]) throw errors.notFound("Пользователь не найден.");

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (patch.displayName !== undefined) updates.displayName = patch.displayName;
  if (patch.nickname !== undefined) updates.nickname = patch.nickname || null;
  if (patch.branch !== undefined) updates.branch = patch.branch || null;
  if (patch.gameId !== undefined) {
    updates.gameId = patch.gameId || null;
    // Changing the Game ID resets verification — it must be re-confirmed.
    updates.gameIdVerifiedAt = null;
    updates.gameIdVerifiedBy = null;
  }

  const updated = await db.update(users).set(updates).where(eq(users.id, userId)).returning();

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "UPDATE_PROFILE",
    entityType: "user",
    entityId: userId,
    targetLabel: updated[0]?.displayName ?? null,
    oldValue: {
      displayName: before[0].displayName,
      nickname: before[0].nickname,
      branch: before[0].branch,
      gameId: before[0].gameId,
    },
    newValue: {
      displayName: updated[0]?.displayName,
      nickname: updated[0]?.nickname,
      branch: updated[0]?.branch,
      gameId: updated[0]?.gameId,
    },
    ip,
    departmentId: null,
  });
  return updated[0];
}

export async function setUserStatus(
  userId: number,
  input: z.infer<typeof setStatusSchema>,
  actor: Actor,
  ip: string | null,
) {
  if (userId === actor.userId) throw errors.conflict("Вы не можете изменить собственный статус.", "SELF_ACTION");
  const targetRoles = await db
    .select({ level: roles.level })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  const targetLevel = targetRoles.reduce((max, r) => Math.max(max, r.level), 0);
  if (!isFounder(actor) && targetLevel >= maxLevel(actor)) {
    throw errors.forbidden("Вы не можете изменить статус администратора равного или более высокого уровня.", "HIERARCHY_VIOLATION");
  }

  const before = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!before[0]) throw errors.notFound("Пользователь не найден.");

  const updated = await db
    .update(users)
    .set({ status: input.status, statusReason: input.reason, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: input.status === "active" ? "UNBLOCK_USER" : "SET_USER_STATUS",
    entityType: "user",
    entityId: userId,
    targetLabel: before[0].displayName,
    oldValue: before[0].status,
    newValue: input.status,
    reason: input.reason,
    ip,
  });

  if (input.status === "blocked" || input.status === "suspended") {
    await notify({
      userId,
      type: "account_blocked",
      title: `Аккаунт: ${input.status}`,
      body: `Ваш статус: ${input.status}. Причина: ${input.reason}`,
    });
  } else if (before[0].status === "blocked" || before[0].status === "suspended") {
    await notify({
      userId,
      type: "account_unblocked",
      title: "Аккаунт восстановлен",
      body: `Ваш статус: ${input.status}.`,
    });
  }
  return updated[0];
}

export async function verifyGameId(
  userId: number,
  input: z.infer<typeof verifyGameIdSchema>,
  actor: Actor,
  ip: string | null,
) {
  const before = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!before[0]) throw errors.notFound("Пользователь не найден.");
  if (!before[0].gameId) throw errors.conflict("У пользователя нет Game ID для подтверждения.", "NO_GAME_ID");

  const updated = await db
    .update(users)
    .set(
      input.verified
        ? { gameIdVerifiedAt: new Date(), gameIdVerifiedBy: actor.userId, updatedAt: new Date() }
        : { gameIdVerifiedAt: null, gameIdVerifiedBy: null, updatedAt: new Date() },
    )
    .where(eq(users.id, userId))
    .returning();

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: input.verified ? "VERIFY_GAME_ID" : "REVOKE_GAME_ID",
    entityType: "user",
    entityId: userId,
    targetLabel: before[0].displayName,
    oldValue: before[0].gameIdVerifiedAt ? "verified" : "unverified",
    newValue: input.verified ? "verified" : "unverified",
    reason: input.reason ?? null,
    ip,
  });

  if (input.verified) {
    await notify({
      userId,
      type: "game_id_verified",
      title: "Game ID подтверждён",
      body: `Ваш Game ID (${before[0].gameId}) подтверждён администратором.`,
    });
  }
  return updated[0];
}

/* --------------------------------- Roles ----------------------------------- */

const targetRoleQuery = z.object({
  roleKey: z.string().trim().min(1).max(80),
});

export async function assignRole(
  userId: number,
  input: z.infer<typeof targetRoleQuery>,
  actor: Actor,
  ip: string | null,
) {
  if (userId === actor.userId) throw errors.conflict("Вы не можете изменять собственные роли.", "SELF_ACTION");

  const roleRows = await db.select().from(roles).where(eq(roles.key, input.roleKey)).limit(1);
  const targetRole = roleRows[0];
  if (!targetRole) throw errors.notFound("Роль не найдена.");

  const assignDecision = canAssignRole(actor, targetRole);
  if (!assignDecision.allowed) {
    throw errors.forbidden(`Невозможно выдать роль «${targetRole.name}».`, assignDecision.reason ?? "FORBIDDEN");
  }
  if (targetRole.category === "administration") {
    const manageDecision = canManageAdminUsers(actor);
    if (!manageDecision.allowed) {
      throw errors.forbidden("Вы не можете управлять административными ролями.", manageDecision.reason ?? "FORBIDDEN");
    }
  }

  // Hierarchy: the new role's permissions must all be held by the assigner (Founder exempt).
  if (!isFounder(actor)) {
    const granted = await db
      .select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, targetRole.id));
    const actorPerms = new Set<string>();
    for (const role of actor.roles) for (const p of role.permissions) actorPerms.add(p);
    const missing = granted.map((g) => g.key).filter((k) => !actorPerms.has(k));
    if (missing.length > 0) {
      throw errors.forbidden(
        `Вы не можете выдавать разрешения, которых у вас нет: ${missing.join(", ")}.`,
        "CANNOT_GRANT_PERMISSION",
      );
    }
  }

  const targetRoles = await db
    .select({ level: roles.level })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  const targetLevel = targetRoles.reduce((max, r) => Math.max(max, r.level), 0);
  if (!isFounder(actor) && targetLevel >= maxLevel(actor)) {
    throw errors.forbidden("Вы не можете изменять администратора равного или более высокого уровня.", "HIERARCHY_VIOLATION");
  }

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows[0]) throw errors.notFound("Пользователь не найден.");

  try {
    await db.insert(userRoles).values({ userId, roleId: targetRole.id, assignedBy: actor.userId });
  } catch {
    throw errors.conflict("У пользователя уже есть эта роль.", "ROLE_ALREADY_ASSIGNED");
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "ASSIGN_ROLE",
    entityType: "user_role",
    entityId: `${userId}:${targetRole.key}`,
    targetLabel: userRows[0].displayName,
    oldValue: null,
    newValue: targetRole.name,
    ip,
  });

  await notify({
    userId,
    type: "role_changed",
    title: "Роль выдана",
    body: `Вам выдана роль «${targetRole.name}».`,
    link: "/settings?section=administration",
  });

  return { roleKey: targetRole.key, role: targetRole.name };
}

export async function removeRole(userId: number, roleKey: string, actor: Actor, ip: string | null) {
  if (userId === actor.userId) throw errors.conflict("Вы не можете изменять собственные роли.", "SELF_ACTION");

  const roleRows = await db.select().from(roles).where(eq(roles.key, roleKey)).limit(1);
  const targetRole = roleRows[0];
  if (!targetRole) throw errors.notFound("Роль не найдена.");

  const assignDecision = canAssignRole(actor, targetRole);
  if (!assignDecision.allowed) {
    throw errors.forbidden(`Невозможно отозвать роль «${targetRole.name}».`, assignDecision.reason ?? "FORBIDDEN");
  }
  if (targetRole.category === "administration" && !canManageAdminUsers(actor).allowed) {
    throw errors.forbidden("Вы не можете управлять административными ролями.", "FORBIDDEN");
  }

  const targetRoles = await db
    .select({ level: roles.level })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId));
  const targetLevel = targetRoles.reduce((max, r) => Math.max(max, r.level), 0);
  if (!isFounder(actor) && targetLevel >= maxLevel(actor)) {
    throw errors.forbidden("Вы не можете изменять администратора равного или более высокого уровня.", "HIERARCHY_VIOLATION");
  }

  const removed = await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, targetRole.id)))
    .returning();
  if (removed.length === 0) throw errors.notFound("У пользователя нет этой роли.");

  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "REMOVE_ROLE",
    entityType: "user_role",
    entityId: `${userId}:${targetRole.key}`,
    targetLabel: userRows[0]?.displayName ?? null,
    oldValue: targetRole.name,
    newValue: null,
    ip,
  });

  await notify({
    userId,
    type: "role_changed",
    title: "Роль отозвана",
    body: `С вашего аккаунта снята роль «${targetRole.name}».`,
  });

  return { roleKey: targetRole.key };
}

export const assignRoleSchema = targetRoleQuery;
