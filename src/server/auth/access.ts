import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, oauthAccounts, userRoles, roles, rolePermissions, servers } from "@/db/schema";
import type { Actor, ActorRole } from "@/lib/rbac/engine";
import { summarizePermissions } from "@/lib/rbac/engine";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { readSessionToken } from "./session";

export interface AuthUser {
  id: number;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  gameId: string | null;
  gameIdVerifiedAt: Date | null;
  serverId: number;
  serverNumber: number;
  status: string;
  statusReason: string | null;
  branch: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthContext {
  user: AuthUser;
  actor: Actor;
  /** Effective permission set (union of all roles, any scope). Used for UI gating. */
  permissions: Set<PermissionKey>;
  connectedProviders: { provider: string; username: string | null; avatarUrl: string | null }[];
}

interface RoleRow {
  id: number;
  key: string;
  name: string;
  level: number;
  category: string;
  managesAdminRoles: boolean;
  departmentId: number | null;
  permissions: string[] | null;
}

/**
 * Loads the authenticated user together with roles & permissions.
 * Returns null when there is no valid session, the user was deleted,
 * the token was revoked (tokenVersion) or the account is blocked.
 */
export async function getAuth(): Promise<AuthContext | null> {
  const session = await readSessionToken();
  if (!session) return null;

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      gameId: users.gameId,
      gameIdVerifiedAt: users.gameIdVerifiedAt,
      serverId: users.serverId,
      serverNumber: servers.serverNumber,
      status: users.status,
      statusReason: users.statusReason,
      branch: users.branch,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      tokenVersion: users.tokenVersion,
    })
    .from(users)
    .innerJoin(servers, eq(servers.id, users.serverId))
    .where(eq(users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;
  if (user.tokenVersion !== session.tokenVersion) return null; // revoked session
  if (user.status === "blocked") return null;

  const roleRows = (await db
    .select({
      id: roles.id,
      key: roles.key,
      name: roles.name,
      level: roles.level,
      category: roles.category,
      managesAdminRoles: roles.managesAdminRoles,
      departmentId: roles.departmentId,
      permissions: sql<string[] | null>`array_agg(${rolePermissions.permissionKey})`.as("permissions"),
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(userRoles.userId, session.userId))
    .groupBy(roles.id)) as RoleRow[];

  const actorRoles: ActorRole[] = roleRows.map((row) => ({
    key: row.key,
    name: row.name,
    level: row.level,
    category: row.category,
    managesAdminRoles: row.managesAdminRoles,
    departmentId: row.departmentId,
    permissions: (row.permissions ?? []).filter((p): p is string => Boolean(p)),
  }));

  const actor: Actor = { userId: user.id, status: user.status, roles: actorRoles };

  const providerRows = await db
    .select({
      provider: oauthAccounts.provider,
      username: oauthAccounts.providerUsername,
      avatarUrl: oauthAccounts.providerAvatarUrl,
    })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, session.userId));

  const { tokenVersion: _tv, ...safeUser } = user;

  return {
    user: safeUser,
    actor,
    permissions: new Set(summarizePermissions(actor)),
    connectedProviders: providerRows,
  };
}

/** Loads any user's profile view (used by profile pages). */
export async function loadPublicProfile(userId: number) {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      gameId: users.gameId,
      gameIdVerifiedAt: users.gameIdVerifiedAt,
      serverNumber: servers.serverNumber,
      status: users.status,
      statusReason: users.statusReason,
      branch: users.branch,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .innerJoin(servers, eq(servers.id, users.serverId))
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}
