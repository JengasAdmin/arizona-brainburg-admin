import { describe, expect, it } from "vitest";
import { PERMISSIONS, PERMISSION_KEYS, PERMISSION_MAP } from "@/lib/rbac/permissions";
import { DEPARTMENTS, ROLE_DEFINITIONS, ROLE_MAP } from "@/lib/rbac/roles";

const roleKeys = new Set(ROLE_DEFINITIONS.map((r) => r.key));
const roleNames = new Set(ROLE_DEFINITIONS.map((r) => r.name));
const permKeys = new Set<string>(PERMISSION_KEYS);
const deptKeys = new Set<string>(DEPARTMENTS.map((d) => d.key));

describe("permission catalog", () => {
  it("has 36 permissions with unique keys", () => {
    expect(PERMISSION_KEYS.length).toBe(36);
    expect(PERMISSIONS.length).toBe(36);
    expect(permKeys.size).toBe(36);
  });

  it("every definition matches its key and map is complete", () => {
    for (const def of PERMISSIONS) {
      expect(permKeys.has(def.key)).toBe(true);
      expect(PERMISSION_MAP[def.key]).toBe(def);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
    }
  });
});

describe("role catalog", () => {
  it("has 39 roles with unique keys and names", () => {
    expect(ROLE_DEFINITIONS.length).toBe(39);
    expect(roleKeys.size).toBe(39);
    expect(roleNames.size).toBe(39);
  });

  it("every role permission is a real catalog key", () => {
    for (const role of ROLE_DEFINITIONS) {
      for (const perm of role.permissions) {
        expect(permKeys.has(perm), `${role.key} → ${perm}`).toBe(true);
      }
    }
  });

  it("every scoped role references a real department", () => {
    for (const role of ROLE_DEFINITIONS) {
      if (role.departmentKey) expect(deptKeys.has(role.departmentKey)).toBe(true);
    }
  });

  it("supervision roles = 8 directions × 4 tiers, all scoped, none manage admin roles", () => {
    const supervisors = ROLE_DEFINITIONS.filter((r) => r.category === "supervision");
    expect(supervisors.length).toBe(32);
    for (const role of supervisors) {
      expect(role.departmentKey, role.key).toBeDefined();
      expect(role.managesAdminRoles, role.key).toBe(false);
      expect(role.level).toBeGreaterThanOrEqual(58);
      expect(role.level).toBeLessThanOrEqual(70);
    }
    const directions = new Set(supervisors.map((r) => r.departmentKey));
    expect(directions.size).toBe(8);
  });

  it("supervisor tiers are strictly ordered: chief > deputy chief > senior > supervisor", () => {
    const chief = ROLE_MAP["sup_state_chief"]!;
    const deputy = ROLE_MAP["sup_state_deputy_chief"]!;
    const senior = ROLE_MAP["sup_state_senior"]!;
    const supervisor = ROLE_MAP["sup_state_supervisor"]!;
    expect(chief.level).toBeGreaterThan(deputy.level);
    expect(deputy.level).toBeGreaterThan(senior.level);
    expect(senior.level).toBeGreaterThan(supervisor.level);
    // Higher tier = superset of lower tier permissions.
    const hasAll = (a: string[], b: string[]) => b.every((p) => a.includes(p));
    expect(hasAll(chief.permissions, deputy.permissions)).toBe(true);
    expect(hasAll(deputy.permissions, senior.permissions)).toBe(true);
    expect(hasAll(senior.permissions, supervisor.permissions)).toBe(true);
  });

  it("only the four critical roles manage admin roles", () => {
    const flagged = ROLE_DEFINITIONS.filter((r) => r.managesAdminRoles).map((r) => r.key);
    expect(flagged.sort()).toEqual(
      ["chief_administrator", "curator", "deputy_chief_administrator", "site_founder"].sort(),
    );
  });

  it("only critical roles hold MANAGE_ROLES / MANAGE_PERMISSIONS / MANAGE_ADMINS", () => {
    const criticalFour = ["chief_administrator", "curator", "deputy_chief_administrator", "site_founder"].sort();
    for (const key of ["MANAGE_ROLES", "MANAGE_ADMINS"]) {
      const holders = ROLE_DEFINITIONS.filter((r) => r.permissions.includes(key as never)).map(
        (r) => r.key,
      );
      expect(holders.sort(), key).toEqual(criticalFour);
    }
    // Curator deliberately cannot edit permission sets (role description: "Cannot edit permission sets").
    const permissionHolders = ROLE_DEFINITIONS.filter((r) =>
      r.permissions.includes("MANAGE_PERMISSIONS"),
    ).map((r) => r.key);
    expect(permissionHolders.sort()).toEqual(
      ["chief_administrator", "deputy_chief_administrator", "site_founder"].sort(),
    );
    expect(ROLE_MAP["curator"]!.permissions).not.toContain("MANAGE_PERMISSIONS");
  });

  it("Founder holds every permission; Deputy Chief lacks SYSTEM_SETTINGS + MANAGE_INTEGRATION", () => {
    const founder = ROLE_MAP["site_founder"]!;
    expect(founder.permissions.length).toBe(PERMISSION_KEYS.length);
    const deputyChief = ROLE_MAP["deputy_chief_administrator"]!;
    expect(deputyChief.permissions).not.toContain("SYSTEM_SETTINGS");
    expect(deputyChief.permissions).not.toContain("MANAGE_INTEGRATION");
    expect(deputyChief.permissions).toContain("MANAGE_PERMISSIONS");
    const curator = ROLE_MAP["curator"]!;
    expect(curator.permissions).not.toContain("MANAGE_PERMISSIONS");
    expect(curator.permissions).not.toContain("SYSTEM_SETTINGS");
  });

  it("level ordering: Founder 100 > Chief 90 > Deputy Chief 85 > Curator 80 > L4 45 > L3 40 > Player 0", () => {
    const level = (key: string) => ROLE_MAP[key]!.level;
    expect(level("site_founder")).toBe(100);
    expect(level("chief_administrator")).toBeGreaterThan(level("deputy_chief_administrator"));
    expect(level("deputy_chief_administrator")).toBeGreaterThan(level("curator"));
    expect(level("curator")).toBeGreaterThan(level("administrator_level_4"));
    expect(level("administrator_level_4")).toBeGreaterThan(level("administrator_level_3"));
    expect(level("administrator_level_3")).toBeGreaterThan(level("player"));
    expect(level("player")).toBe(0);
  });

  it("player role is view-only", () => {
    const player = ROLE_MAP["player"]!;
    expect(player.category).toBe("player");
    expect(player.permissions).not.toContain("VIEW_USERS");
    expect(player.permissions).not.toContain("VIEW_AUDIT_LOGS");
    expect(player.permissions).toContain("VIEW_DASHBOARD");
  });
});
