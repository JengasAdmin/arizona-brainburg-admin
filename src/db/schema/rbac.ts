import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { users as usersRef } from "./users";
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

/** Supervision areas ("directions") used for specialized/scoped access. */
export const departments = pgTable(
  "departments",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(), // e.g. ministry_of_justice
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("departments_key_uq").on(t.key)],
);

/**
 * Roles. `level` encodes the permission hierarchy:
 * 100 Site Founder / Developer > 90 Chief Administrator > 85 Deputy Chief
 * Administrator > 80 Curator > 70..58 specialized supervisors > 45/40 admins > 0 player.
 */
export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    /** Hierarchy level — a role may never assign/manage a role above its own level. */
    level: integer("level").notNull().default(0),
    /** administration | supervision | player */
    category: text("category").notNull().default("player"),
    /** Only Founder/Chief/Deputy Chief/Curator may hold admin-management roles. */
    managesAdminRoles: boolean("manages_admin_roles").notNull().default(false),
    /** When set, every permission of this role is scoped to this department only. */
    departmentId: integer("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    /** System roles cannot be deleted or renamed through the UI. */
    isSystem: boolean("is_system").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("roles_key_uq").on(t.key), index("roles_level_idx").on(t.level)],
);

/** Permission catalog (seeded from `src/lib/rbac/permissions.ts`). */
export const permissions = pgTable(
  "permissions",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    /** Users | Leadership | Deputies | Factions | Budget | Administration | System | Logs */
    group: text("group").notNull(),
    /** true → the permission can be granted per-department (scoped roles). */
    scoped: boolean("scoped").notNull().default(true),
    /** Critical permissions may only be granted by Founder/Chief/Deputy Chief/Curator. */
    critical: boolean("critical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("permissions_key_uq").on(t.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionKey] }),
    index("role_permissions_permission_idx").on(t.permissionKey),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersRef.id, { onDelete: "cascade" }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: integer("assigned_by").references((): AnyPgColumn => userRoles.userId, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index("user_roles_role_idx").on(t.roleId),
  ],
);
