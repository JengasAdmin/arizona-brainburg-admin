import { summarizePermissions, type Actor, type ActorRole } from "@/lib/rbac/engine";
import { DEPARTMENTS, ROLE_MAP } from "@/lib/rbac/roles";
import type { AuthContext } from "@/server/auth/access";

/** Deterministic department id for a catalog department key (tests only). */
export function departmentIdOf(departmentKey: string | undefined): number | null {
  if (!departmentKey) return null;
  const index = DEPARTMENTS.findIndex((d) => d.key === departmentKey);
  if (index === -1) throw new Error(`Unknown department key: ${departmentKey}`);
  return index + 1;
}

/** Build an Actor from catalog role keys (mirrors how access.ts assembles actors). */
export function actorFromRoles(roleKeys: string[], status = "active", userId = 1): Actor {
  const roles: ActorRole[] = roleKeys.map((key) => {
    const def = ROLE_MAP[key];
    if (!def) throw new Error(`Unknown role key: ${key}`);
    return {
      key: def.key,
      name: def.name,
      level: def.level,
      category: def.category,
      managesAdminRoles: def.managesAdminRoles,
      departmentId: departmentIdOf(def.departmentKey),
      permissions: [...def.permissions],
    };
  });
  return { userId, status, roles };
}

/** Build an AuthContext around an Actor (used by guard tests). */
export function authFromActor(actor: Actor): AuthContext {
  return {
    user: {
      id: actor.userId,
      displayName: `User ${actor.userId}`,
      nickname: null,
      avatarUrl: null,
      gameId: null,
      gameIdVerifiedAt: null,
      serverId: 1,
      serverNumber: 5,
      status: actor.status,
      statusReason: null,
      branch: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      lastLoginAt: new Date("2026-09-01T00:00:00Z"),
    },
    actor,
    permissions: new Set(summarizePermissions(actor)),
    connectedProviders: [],
  };
}
