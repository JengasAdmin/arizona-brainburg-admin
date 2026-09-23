import { describe, expect, it } from "vitest";
import {
  actorDepartments,
  can,
  canAssignRole,
  canGrantPermission,
  canManageAdminUsers,
  isFounder,
  maxLevel,
  summarizePermissions,
  type Actor,
} from "@/lib/rbac/engine";
import { PERMISSION_KEYS } from "@/lib/rbac/permissions";
import { ROLE_MAP, ADMIN_ROLE_MANAGEMENT_KEYS, FOUNDER_ROLE_KEY } from "@/lib/rbac/roles";
import { actorFromRoles, departmentIdOf } from "./helpers";

const founder = () => actorFromRoles(["site_founder"]);
const chief = () => actorFromRoles(["chief_administrator"]);
const curator = () => actorFromRoles(["curator"]);
const adminL4 = () => actorFromRoles(["administrator_level_4"]);
const adminL3 = () => actorFromRoles(["administrator_level_3"]);
const player = () => actorFromRoles(["player"]);
const stateSupervisor = () => actorFromRoles(["sup_state_supervisor"]);
const stateChiefSupervisor = () => actorFromRoles(["sup_state_chief"]);

describe("can() — basic permission checks", () => {
  it("Founder has full access to every permission", () => {
    for (const perm of PERMISSION_KEYS) {
      expect(can(founder(), perm).allowed, perm).toBe(true);
    }
  });

  it("denies unknown permissions", () => {
    const decision = can(founder(), "NOT_A_REAL_PERMISSION");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("UNKNOWN_PERMISSION");
  });

  it("denies everything for non-active accounts (suspended/blocked/inactive)", () => {
    for (const status of ["suspended", "blocked", "inactive"]) {
      const actor = actorFromRoles(["site_founder"], status);
      const decision = can(actor, "VIEW_DASHBOARD");
      expect(decision.allowed, status).toBe(false);
      expect(decision.reason).toBe("ACCOUNT_NOT_ACTIVE");
    }
  });

  it("Administrator Level 3 is read-mostly: no audit log, no role management, no budget writes", () => {
    const actor = adminL3();
    expect(can(actor, "VIEW_DASHBOARD").allowed).toBe(true);
    expect(can(actor, "VIEW_AUDIT_LOGS").allowed).toBe(false);
    expect(can(actor, "MANAGE_ROLES").allowed).toBe(false);
    expect(can(actor, "MANAGE_PERMISSIONS").allowed).toBe(false);
    expect(can(actor, "MANAGE_BUDGET").allowed).toBe(false);
    expect(can(actor, "APPOINT_LEADER").allowed).toBe(false);
    expect(can(actor, "BLOCK_USERS").allowed).toBe(false);
  });

  it("Administrator Level 4 can read audit logs but still cannot manage roles or appoint leaders", () => {
    const actor = adminL4();
    expect(can(actor, "VIEW_AUDIT_LOGS").allowed).toBe(true);
    expect(can(actor, "GIVE_WARNING").allowed).toBe(true);
    expect(can(actor, "MANAGE_ROLES").allowed).toBe(false);
    expect(can(actor, "APPOINT_LEADER").allowed).toBe(false);
    expect(can(actor, "MANAGE_BUDGET").allowed).toBe(false);
  });

  it("Player holds only view-level defaults", () => {
    const actor = player();
    expect(can(actor, "VIEW_DASHBOARD").allowed).toBe(true);
    expect(can(actor, "VIEW_USERS").allowed).toBe(false);
    expect(can(actor, "VIEW_AUDIT_LOGS").allowed).toBe(false);
    expect(can(actor, "CREATE_GAME_ACTIVITY").allowed).toBe(false);
  });
});

describe("scope — specialized supervisors act only inside their direction", () => {
  const stateDept = departmentIdOf("state_structures")!;
  const healthDept = departmentIdOf("healthcare")!;

  it("scoped role passes inside its own department", () => {
    expect(can(stateSupervisor(), "VIEW_BUDGET", { departmentId: stateDept }).allowed).toBe(true);
  });

  it("scoped role is denied in another department (out-of-scope)", () => {
    const decision = can(stateSupervisor(), "VIEW_BUDGET", { departmentId: healthDept });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MISSING_PERMISSION");
  });

  it("scoped role is denied on global operations (explicit null scope)", () => {
    expect(can(stateSupervisor(), "VIEW_BUDGET", { departmentId: null }).allowed).toBe(false);
  });

  it("scoped role passes an unscoped read — the query layer filters rows by scope", () => {
    expect(can(stateSupervisor(), "VIEW_BUDGET").allowed).toBe(true);
  });

  it("chief supervisor tier holds appointment powers inside its scope only", () => {
    const chiefSup = stateChiefSupervisor();
    expect(can(chiefSup, "APPOINT_LEADER", { departmentId: stateDept }).allowed).toBe(true);
    expect(can(chiefSup, "APPOINT_LEADER", { departmentId: healthDept }).allowed).toBe(false);
  });

  it("plain supervisor tier lacks appointment powers entirely", () => {
    expect(can(stateSupervisor(), "APPOINT_LEADER", { departmentId: stateDept }).allowed).toBe(false);
  });
});

describe("canAssignRole() — hierarchy rules", () => {
  const adminTarget = { key: "administrator_level_3", level: 40, category: "administration" };
  const chiefAdminTarget = { key: "chief_administrator", level: 90, category: "administration" };
  const playerTarget = { key: "player", level: 0, category: "player" };

  it("Founder can assign anything", () => {
    expect(canAssignRole(founder(), chiefAdminTarget).allowed).toBe(true);
    expect(canAssignRole(founder(), { key: "x", level: 999 }).allowed).toBe(true);
  });

  it("players cannot manage roles at all", () => {
    const decision = canAssignRole(player(), playerTarget);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MISSING_MANAGE_ROLES");
  });

  it("Administrator L3/L4 cannot manage roles (no MANAGE_ROLES)", () => {
    expect(canAssignRole(adminL3(), playerTarget).reason).toBe("MISSING_MANAGE_ROLES");
    expect(canAssignRole(adminL4(), playerTarget).reason).toBe("MISSING_MANAGE_ROLES");
  });

  it("nobody assigns a role above their own level — even Founder's Chief target for Curator", () => {
    const decision = canAssignRole(curator(), chiefAdminTarget); // level 90 > Curator 80
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("ROLE_ABOVE_OWN_LEVEL");
    // Chief Administrator (90) may not assign Founder-level roles (100).
    expect(canAssignRole(chief(), { key: "site_founder", level: 100 }).reason).toBe(
      "ROLE_ABOVE_OWN_LEVEL",
    );
  });

  it("Curator (critical 4) may assign roles below its level, including admin roles", () => {
    expect(canAssignRole(curator(), adminTarget).allowed).toBe(true);
    expect(canAssignRole(curator(), playerTarget).allowed).toBe(true);
    expect(canAssignRole(curator(), { key: "sup_state_chief", level: 70 }).allowed).toBe(true);
  });

  it("only the critical 4 may touch roles in the administration category", () => {
    // A high-level actor with MANAGE_ROLES but outside the critical set.
    const outsider: Actor = {
      userId: 7,
      status: "active",
      roles: [
        {
          key: "custom_admin_manager",
          name: "Custom Admin Manager",
          level: 95,
          category: "supervision",
          managesAdminRoles: false,
          departmentId: null,
          permissions: ["MANAGE_ROLES", "VIEW_DASHBOARD"],
        },
      ],
    };
    const decision = canAssignRole(outsider, adminTarget);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NOT_ALLOWED_TO_MANAGE_ADMINS");
    // Same actor may still assign non-administration roles.
    expect(canAssignRole(outsider, playerTarget).allowed).toBe(true);
  });

  it("exactly the four critical roles are flagged managesAdminRoles in the catalog", () => {
    const flagged = Object.values(ROLE_MAP)
      .filter((r) => r.managesAdminRoles)
      .map((r) => r.key)
      .sort();
    expect(flagged).toEqual([...ADMIN_ROLE_MANAGEMENT_KEYS].sort());
    expect(ADMIN_ROLE_MANAGEMENT_KEYS).toContain(FOUNDER_ROLE_KEY);
  });
});

describe("canGrantPermission() — you can never grant what you do not hold", () => {
  it("Founder may grant anything", () => {
    expect(canGrantPermission(founder(), "SYSTEM_SETTINGS").allowed).toBe(true);
    expect(canGrantPermission(founder(), "TOTALLY_BOGUS").allowed).toBe(true);
  });

  it("Curator cannot grant permissions (holds MANAGE_ROLES but not MANAGE_PERMISSIONS)", () => {
    const decision = canGrantPermission(curator(), "VIEW_DASHBOARD");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MISSING_MANAGE_PERMISSIONS");
  });

  it("Deputy Chief Administrator may grant what it holds but not SYSTEM_SETTINGS", () => {
    const deputyChief = actorFromRoles(["deputy_chief_administrator"]);
    expect(canGrantPermission(deputyChief, "MANAGE_BUDGET").allowed).toBe(true);
    const decision = canGrantPermission(deputyChief, "SYSTEM_SETTINGS");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("CANNOT_GRANT_OWNLY_WHAT_YOU_HAVE");
  });

  it("Chief Administrator holds SYSTEM_SETTINGS and may grant it", () => {
    expect(canGrantPermission(chief(), "SYSTEM_SETTINGS").allowed).toBe(true);
  });

  it("actors without MANAGE_PERMISSIONS cannot grant anything", () => {
    expect(canGrantPermission(adminL4(), "VIEW_DASHBOARD").reason).toBe(
      "MISSING_MANAGE_PERMISSIONS",
    );
  });
});

describe("canManageAdminUsers()", () => {
  it("Founder and Curator pass", () => {
    expect(canManageAdminUsers(founder()).allowed).toBe(true);
    expect(canManageAdminUsers(curator()).allowed).toBe(true);
    expect(canManageAdminUsers(chief()).allowed).toBe(true);
  });

  it("Administrator L4 fails — no MANAGE_ADMINS permission", () => {
    const decision = canManageAdminUsers(adminL4());
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MISSING_PERMISSION");
  });

  it("MANAGE_ADMINS without managesAdminRoles flag still fails", () => {
    const outsider: Actor = {
      userId: 8,
      status: "active",
      roles: [
        {
          key: "custom",
          name: "Custom",
          level: 95,
          category: "supervision",
          managesAdminRoles: false,
          departmentId: null,
          permissions: ["MANAGE_ADMINS"],
        },
      ],
    };
    const decision = canManageAdminUsers(outsider);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("ROLE_CANNOT_MANAGE_ADMINS");
  });
});

describe("helpers", () => {
  it("isFounder / maxLevel", () => {
    expect(isFounder(founder())).toBe(true);
    expect(isFounder(curator())).toBe(false);
    expect(maxLevel(curator())).toBe(80);
    expect(maxLevel(player())).toBe(0);
    expect(
      maxLevel(actorFromRoles(["player", "administrator_level_4"])),
    ).toBe(45);
  });

  it("actorDepartments — global roles and Founder see every department", () => {
    expect(actorDepartments(founder())).toBeNull();
    expect(actorDepartments(adminL4())).toBeNull(); // departmentId === null role
    const scoped = actorDepartments(stateSupervisor());
    expect(scoped).toEqual([departmentIdOf("state_structures")]);
    const multi = actorDepartments(
      actorFromRoles(["sup_state_supervisor", "sup_health_supervisor"]),
    );
    expect(multi?.length).toBe(2);
  });

  it("summarizePermissions returns a de-duplicated union of valid keys", () => {
    const actor = actorFromRoles([
      "administrator_level_3",
      "administrator_level_4",
      "player",
    ]);
    const perms = summarizePermissions(actor);
    expect(new Set(perms).size).toBe(perms.length);
    expect(perms).toContain("VIEW_AUDIT_LOGS"); // comes from L4 only
    expect(perms).toContain("VIEW_DASHBOARD");
    for (const p of perms) expect(PERMISSION_KEYS).toContain(p);
  });
});
