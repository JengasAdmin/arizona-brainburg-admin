import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import {
  budgetAccounts,
  departments,
  factionCategories,
  factionPositions,
  factions,
  permissions,
  rolePermissions,
  roles,
  servers,
  systemSettings,
} from "../src/db/schema";
import { DEPARTMENTS, PERMISSIONS, ROLE_DEFINITIONS } from "../src/lib/rbac";
import { FACTIONS, FACTION_CATEGORIES } from "../src/lib/catalog/factions";
import { DEFAULT_SETTINGS } from "../src/lib/settings-catalog";

/**
 * Idempotent seed: Server #5, departments, permissions, all administrative roles,
 * role↔permission relations, 14 factions, faction positions, budget accounts and
 * system settings. Creates NO real users (use `--demo` for local demo data).
 *
 * Production databases start clean apart from this structural seed.
 */
async function main() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DIRECT_URL / DATABASE_URL is not set. Copy .env.example → .env.local");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool, { schema });

  console.log("Seeding ARIZONA RP — BRAINBURG (#5) …");

  // 1. Server #5 ---------------------------------------------------------------
  await db
    .insert(servers)
    .values({ serverNumber: 5, name: "Arizona RP — Brainburg #5" })
    .onConflictDoNothing({ target: servers.serverNumber });

  // 2. Departments -------------------------------------------------------------
  for (const [index, dep] of DEPARTMENTS.entries()) {
    await db
      .insert(departments)
      .values({ key: dep.key, name: dep.name, description: dep.description, sortOrder: index })
      .onConflictDoUpdate({
        target: departments.key,
        set: { name: dep.name, description: dep.description, sortOrder: index },
      });
  }

  // 3. Permissions -------------------------------------------------------------
  for (const perm of PERMISSIONS) {
    await db
      .insert(permissions)
      .values({
        key: perm.key,
        name: perm.name,
        description: perm.description,
        group: perm.group,
        scoped: perm.scoped,
        critical: perm.critical,
      })
      .onConflictDoUpdate({
        target: permissions.key,
        set: {
          name: perm.name,
          description: perm.description,
          group: perm.group,
          scoped: perm.scoped,
          critical: perm.critical,
        },
      });
  }

  // 4. Departments map for role scoping ----------------------------------------
  const departmentRows = await db.select().from(departments);
  const departmentIdByKey = new Map(departmentRows.map((d) => [d.key, d.id]));

  // 5. Roles -------------------------------------------------------------------
  const seededRoleKeys: string[] = [];
  for (const role of ROLE_DEFINITIONS) {
    const departmentId = role.departmentKey ? departmentIdByKey.get(role.departmentKey) ?? null : null;
    await db
      .insert(roles)
      .values({
        key: role.key,
        name: role.name,
        description: role.description,
        level: role.level,
        category: role.category,
        managesAdminRoles: role.managesAdminRoles,
        departmentId,
        isSystem: true,
        sortOrder: role.sortOrder,
      })
      .onConflictDoUpdate({
        target: roles.key,
        set: {
          name: role.name,
          description: role.description,
          level: role.level,
          category: role.category,
          managesAdminRoles: role.managesAdminRoles,
          departmentId,
          sortOrder: role.sortOrder,
        },
      });
    seededRoleKeys.push(role.key);
  }

  // 6. Role ↔ permission relations ---------------------------------------------
  const roleRows = await db.select().from(roles).where(inArray(roles.key, seededRoleKeys));
  const permissionsByRole = new Map(ROLE_DEFINITIONS.map((r) => [r.key, r.permissions]));
  for (const role of roleRows) {
    const keys = permissionsByRole.get(role.key) ?? [];
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    if (keys.length > 0) {
      await db
        .insert(rolePermissions)
        .values(keys.map((key) => ({ roleId: role.id, permissionKey: key })))
        .onConflictDoNothing();
    }
  }

  // 7. Faction categories -------------------------------------------------------
  for (const cat of FACTION_CATEGORIES) {
    await db
      .insert(factionCategories)
      .values(cat)
      .onConflictDoUpdate({ target: factionCategories.key, set: { name: cat.name, description: cat.description } });
  }
  const categoryRows = await db.select().from(factionCategories);
  const categoryIdByKey = new Map(categoryRows.map((c) => [c.key, c.id]));

  // 8. Factions -----------------------------------------------------------------
  for (const faction of FACTIONS) {
    const categoryId = categoryIdByKey.get(faction.categoryKey);
    const departmentId = departmentIdByKey.get(faction.departmentKey);
    if (!categoryId || !departmentId) {
      throw new Error(`Seed error: missing category/department for ${faction.key}`);
    }
    await db
      .insert(factions)
      .values({
        key: faction.key,
        name: faction.name,
        shortName: faction.shortName,
        description: faction.description,
        categoryId,
        departmentId,
        allowMultipleLeaders: faction.allowMultipleLeaders ?? false,
        allowCrossFactionLeadership: false,
        status: "active",
      })
      .onConflictDoUpdate({
        target: factions.key,
        set: {
          name: faction.name,
          shortName: faction.shortName,
          description: faction.description,
          categoryId,
          departmentId,
          allowMultipleLeaders: faction.allowMultipleLeaders ?? false,
        },
      });
  }

  const factionRows = await db.select().from(factions);
  const factionByKey = new Map(factionRows.map((f) => [f.key, f]));

  // 9. Positions + budget accounts ----------------------------------------------
  for (const faction of FACTIONS) {
    const row = factionByKey.get(faction.key);
    if (!row) continue;

    const positions = [
      { key: `${faction.key}_leader`, title: faction.leaderTitle, kind: "leader" as const, sortOrder: 0 },
      ...(faction.deputyTitles ?? []).map((title, index) => ({
        key: `${faction.key}_deputy_${index + 1}`,
        title,
        kind: "deputy" as const,
        sortOrder: index + 1,
      })),
    ];

    for (const position of positions) {
      await db
        .insert(factionPositions)
        .values({ factionId: row.id, ...position, status: "active" })
        .onConflictDoUpdate({
          target: factionPositions.key,
          set: { title: position.title, kind: position.kind, sortOrder: position.sortOrder },
        });
    }

    await db
      .insert(budgetAccounts)
      .values({ factionId: row.id, balance: 0 })
      .onConflictDoNothing({ target: budgetAccounts.factionId });
  }

  // 10. System settings ----------------------------------------------------------
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    await db
      .insert(systemSettings)
      .values({ key, value: def.value, description: def.description })
      .onConflictDoNothing({ target: systemSettings.key });
  }

  // 11. Optional demo data (never runs automatically in production) ---------------
  if (process.argv.includes("--demo")) {
    if (process.env.NODE_ENV === "production") {
      console.warn("Demo seed skipped: NODE_ENV=production.");
    } else {
      const { seedDemo } = await import("./demo");
      await seedDemo(db);
    }
  }

  const counts = {
    servers: (await db.select().from(servers)).length,
    departments: (await db.select().from(departments)).length,
    permissions: (await db.select().from(permissions)).length,
    roles: (await db.select().from(roles)).length,
    factions: (await db.select().from(factions)).length,
    positions: (await db.select().from(factionPositions)).length,
  };
  console.log("Seed complete:", counts);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
