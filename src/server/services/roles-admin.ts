import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { departments, rolePermissions, roles } from "@/db/schema";
import { errors } from "@/server/http";
import {
  canAssignRole,
  canGrantPermission,
  canManageAdminUsers,
  isFounder,
  maxLevel,
  type Actor,
} from "@/lib/rbac/engine";
import { isPermissionKey, PERMISSIONS } from "@/lib/rbac/permissions";
import { writeAudit } from "./audit";

export interface RoleWithPermissions {
  id: number;
  key: string;
  name: string;
  description: string | null;
  level: number;
  category: string;
  managesAdminRoles: boolean;
  departmentId: number | null;
  departmentKey: string | null;
  isSystem: boolean;
  memberCount: number;
  permissions: string[];
}

export async function listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
  const res = await db.execute(sql`
    SELECT r.id, r.key, r.name, r.description, r.level, r.category, r.manages_admin_roles,
           r.department_id, d.key AS department_key, r.is_system,
           (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id = r.id) AS member_count,
           COALESCE(array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), '{}') AS permissions
    FROM roles r
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    GROUP BY r.id, d.key
    ORDER BY r.sort_order, r.level DESC
  `);
  const rows = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<
    string,
    unknown
  >[];
  return rows.map((r) => ({
    id: r.id as number,
    key: r.key as string,
    name: r.name as string,
    description: (r.description as string | null) ?? "",
    level: r.level as number,
    category: r.category as string,
    managesAdminRoles: Boolean(r.manages_admin_roles),
    departmentId: (r.department_id as number | null) ?? null,
    departmentKey: (r.department_key as string | null) ?? null,
    isSystem: Boolean(r.is_system),
    memberCount: r.member_count as number,
    permissions: (r.permissions as string[]) ?? [],
  }));
}

export function permissionCatalog() {
  return PERMISSIONS;
}

export async function listDepartments() {
  return db.select().from(departments).orderBy(asc(departments.sortOrder));
}

export const createRoleSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Ключ должен быть в нижнем регистре: буквы, цифры или подчёркивание."),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  level: z.coerce.number().int().min(0).max(99),
  category: z.enum(["administration", "supervision", "player"]).default("player"),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  permissionKeys: z.array(z.string().max(60)).max(200).default([]),
});

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().max(60)).max(200),
});

async function assertGrantable(actor: Actor, permissionKey: string) {
  if (!isPermissionKey(permissionKey)) {
    throw errors.validation([{ path: "permissionKeys", message: `Неизвестное разрешение: ${permissionKey}` }]);
  }
  const decision = canGrantPermission(actor, permissionKey);
  if (!decision.allowed) {
    throw errors.forbidden(
      `Вы не можете выдать «${permissionKey}».`,
      decision.reason ?? "FORBIDDEN",
    );
  }
}

export async function createCustomRole(
  input: z.infer<typeof createRoleSchema>,
  actor: Actor,
  ip: string | null,
) {
  if (input.level > maxLevel(actor) && !isFounder(actor)) {
    throw errors.forbidden("Вы не можете создать роль выше собственного уровня.", "ROLE_ABOVE_OWN_LEVEL");
  }
  if (input.category === "administration" && !canManageAdminUsers(actor).allowed) {
    throw errors.forbidden("Создавать административные роли могут только критические роли.", "FORBIDDEN");
  }
  if (!isFounder(actor)) {
    for (const key of input.permissionKeys) await assertGrantable(actor, key);
  }

  let roleId: number;
  try {
    const inserted = await db
      .insert(roles)
      .values({
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        level: input.level,
        category: input.category,
        managesAdminRoles: false,
        departmentId: input.departmentId ?? null,
        isSystem: false,
      })
      .returning({ id: roles.id });
    roleId = inserted[0]!.id;
  } catch {
    throw errors.conflict("Роль с таким ключом уже существует.", "ROLE_KEY_EXISTS");
  }

  if (input.permissionKeys.length > 0) {
    const validKeys = input.permissionKeys.filter(isPermissionKey);
    await db.insert(rolePermissions).values(validKeys.map((key) => ({ roleId, permissionKey: key })));
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "CREATE_ROLE",
    entityType: "role",
    entityId: input.key,
    targetLabel: input.name,
    newValue: input,
    ip,
  });

  return { roleKey: input.key, id: roleId };
}

export async function updateRolePermissionSet(
  roleKey: string,
  input: z.infer<typeof updateRolePermissionsSchema>,
  actor: Actor,
  ip: string | null,
) {
  const rows = await db.select().from(roles).where(eq(roles.key, roleKey)).limit(1);
  const role = rows[0];
  if (!role) throw errors.notFound("Роль не найдена.");
  if (role.key === "site_founder") {
    throw errors.forbidden("Разрешения роли Основателя неизменяемы.", "FOUNDER_ROLE_PROTECTED");
  }

  const assignDecision = canAssignRole(actor, role);
  if (!assignDecision.allowed && !isFounder(actor)) {
    throw errors.forbidden("Вы не можете редактировать эту роль.", assignDecision.reason ?? "FORBIDDEN");
  }
  if (role.level > maxLevel(actor) && !isFounder(actor)) {
    throw errors.forbidden("Вы не можете редактировать роль выше собственного уровня.", "ROLE_ABOVE_OWN_LEVEL");
  }

  const uniqueKeys = [...new Set(input.permissionKeys)];
  if (!isFounder(actor)) {
    for (const key of uniqueKeys) await assertGrantable(actor, key);
  } else {
    for (const key of uniqueKeys) {
      if (!isPermissionKey(key)) {
        throw errors.validation([{ path: "permissionKeys", message: `Неизвестное разрешение: ${key}` }]);
      }
    }
  }

  const before = await db
    .select({ key: rolePermissions.permissionKey })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, role.id));

  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  if (uniqueKeys.length > 0) {
    await db
      .insert(rolePermissions)
      .values(uniqueKeys.map((key) => ({ roleId: role.id, permissionKey: key })));
  }
  await db.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, role.id));

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.roles[0]?.name ?? null,
    action: "UPDATE_ROLE_PERMISSIONS",
    entityType: "role",
    entityId: role.key,
    targetLabel: role.name,
    oldValue: before.map((b) => b.key).sort(),
    newValue: [...uniqueKeys].sort(),
    ip,
  });

  return { roleKey: role.key, permissions: uniqueKeys };
}
