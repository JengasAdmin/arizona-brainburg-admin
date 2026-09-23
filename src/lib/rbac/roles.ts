import type { PermissionKey } from "./permissions";

/** Supervision areas (directions) — scoped roles only act inside their own area. */
export const DEPARTMENTS = [
  {
    key: "state_structures",
    name: "State Structures",
    description: "Government and state law-enforcement factions.",
  },
  {
    key: "central_management",
    name: "Central Management",
    description: "Administrative apparatus: media and licensing.",
  },
  {
    key: "ministry_of_justice",
    name: "Ministry of Justice",
    description: "Justice direction (extensible — new factions can be attached).",
  },
  {
    key: "healthcare",
    name: "Healthcare",
    description: "Medical centres, health academy and fire/rescue service.",
  },
  {
    key: "max_prison",
    name: "Maximum Security Prison",
    description: "Las Venturas Maximum Security Prison.",
  },
  {
    key: "ministry_of_defense",
    name: "Ministry of Defense",
    description: "Army factions.",
  },
  {
    key: "ghetto",
    name: "Ghetto",
    description: "Ghetto direction (reserved for future factions).",
  },
  {
    key: "mafia",
    name: "Mafia",
    description: "Mafia direction (reserved for future factions).",
  },
] as const;

export type DepartmentKey = (typeof DEPARTMENTS)[number]["key"];

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  /** Hierarchy level — may never manage/assign anything above its own level. */
  level: number;
  category: "administration" | "supervision" | "player";
  managesAdminRoles: boolean;
  departmentKey?: DepartmentKey;
  permissions: PermissionKey[];
  sortOrder: number;
}

/* -------------------------------------------------------------------------- */
/* Permission sets                                                            */
/* -------------------------------------------------------------------------- */

/** Specialized supervisors — tiered permissions, always scoped to a department. */
function supervisorPermissions(tier: "chief" | "deputy_chief" | "senior" | "supervisor"): PermissionKey[] {
  const base: PermissionKey[] = [
    "VIEW_DASHBOARD",
    "VIEW_USERS",
    "VIEW_PROFILES",
    "VIEW_LEADERS",
    "VIEW_DEPUTIES",
    "VIEW_FACTIONS",
    "VIEW_BUDGET",
    "VIEW_ACTIVITY",
    "VIEW_LOGS",
    "VIEW_NOTIFICATIONS",
  ];
  const senior: PermissionKey[] = [
    ...base,
    "EDIT_PROFILES",
    "EDIT_LEADER",
    "EDIT_LEADER_POINTS",
    "GIVE_WARNING",
    "GIVE_REPRIMAND",
    "MANAGE_DEPUTIES",
    "MANAGE_FACTION_MEMBERS",
    "EDIT_FACTION",
    "CREATE_LOG",
    "CREATE_GAME_ACTIVITY",
  ];
  const deputyChief: PermissionKey[] = [
    ...senior,
    "APPOINT_LEADER",
    "DISMISS_LEADER",
    "BLOCK_USERS",
    "VERIFY_GAME_ID",
    "MANAGE_BUDGET",
    "VIEW_AUDIT_LOGS",
    "MANAGE_NOTIFICATIONS",
  ];
  const chief: PermissionKey[] = [
    ...deputyChief,
    "EDIT_USERS",
    "CREATE_FACTION",
  ];
  if (tier === "supervisor") return base;
  if (tier === "senior") return senior;
  if (tier === "deputy_chief") return deputyChief;
  return chief;
}

/** Every permission — used by the Site Founder / Developer role. */
import { PERMISSION_KEYS, type PermissionKey as PK } from "./permissions";
const ALL_PERMISSIONS: PK[] = [...PERMISSION_KEYS];

/* -------------------------------------------------------------------------- */
/* Specialized supervision roles (8 directions × 4 tiers)                     */
/* -------------------------------------------------------------------------- */

const SUPERVISOR_DEPARTMENTS: {
  dept: DepartmentKey;
  short: string;
  label: string;
}[] = [
  { dept: "state_structures", short: "state", label: "State Structures" },
  { dept: "central_management", short: "central", label: "Central Management" },
  { dept: "ministry_of_justice", short: "justice", label: "Ministry of Justice" },
  { dept: "healthcare", short: "health", label: "Healthcare" },
  { dept: "max_prison", short: "prison", label: "Maximum Security Prison" },
  { dept: "ministry_of_defense", short: "defense", label: "Ministry of Defense" },
  { dept: "ghetto", short: "ghetto", label: "Ghetto" },
  { dept: "mafia", short: "mafia", label: "Mafia" },
];

const TIERS = [
  { tier: "chief" as const, suffix: "chief", label: (l: string) => `Chief Supervisor of ${l}`, level: 70 },
  {
    tier: "deputy_chief" as const,
    suffix: "deputy_chief",
    label: (l: string) => `Deputy Chief Supervisor of ${l}`,
    level: 66,
  },
  { tier: "senior" as const, suffix: "senior", label: (l: string) => `Senior Supervisor of ${l}`, level: 62 },
  {
    tier: "supervisor" as const,
    suffix: "supervisor",
    label: (l: string) => `${l} Supervisor`,
    level: 58,
  },
];

const supervisorRoles: RoleDefinition[] = SUPERVISOR_DEPARTMENTS.flatMap((d, deptIndex) =>
  TIERS.map((t, tierIndex) => ({
    key: `sup_${d.short}_${t.suffix}`,
    name: t.label(d.label),
    description: `${t.label(d.label)} — scoped to the ${d.label} direction only.`,
    level: t.level,
    category: "supervision" as const,
    managesAdminRoles: false,
    departmentKey: d.dept,
    permissions: supervisorPermissions(t.tier),
    sortOrder: 100 + deptIndex * 10 + tierIndex,
  })),
);

/* -------------------------------------------------------------------------- */
/* Full role catalog                                                          */
/* -------------------------------------------------------------------------- */

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "site_founder",
    name: "Site Founder / Developer",
    description:
      "Absolute system level. Full access to every module, role, permission, budget, log and setting.",
    level: 100,
    category: "administration",
    managesAdminRoles: true,
    permissions: ALL_PERMISSIONS,
    sortOrder: 0,
  },
  {
    key: "chief_administrator",
    name: "Chief Administrator",
    description: "Highest administrative level below the founder. Manages administrators, roles, permissions and the system.",
    level: 90,
    category: "administration",
    managesAdminRoles: true,
    permissions: ALL_PERMISSIONS,
    sortOrder: 1,
  },
  {
    key: "deputy_chief_administrator",
    name: "Deputy Chief Administrator",
    description:
      "Manages administrators, roles and permissions. Global system settings and integration keys stay with Chief Administrator/Founder.",
    level: 85,
    category: "administration",
    managesAdminRoles: true,
    permissions: ALL_PERMISSIONS.filter(
      (k) => k !== "SYSTEM_SETTINGS" && k !== "MANAGE_INTEGRATION",
    ),
    sortOrder: 2,
  },
  {
    key: "curator",
    name: "Curator",
    description:
      "Manages administrators and roles strictly below its own level. Cannot edit permission sets or system settings.",
    level: 80,
    category: "administration",
    managesAdminRoles: true,
    permissions: [
      "VIEW_DASHBOARD",
      "VIEW_USERS",
      "EDIT_USERS",
      "BLOCK_USERS",
      "VIEW_PROFILES",
      "EDIT_PROFILES",
      "VERIFY_GAME_ID",
      "VIEW_LEADERS",
      "APPOINT_LEADER",
      "DISMISS_LEADER",
      "EDIT_LEADER",
      "EDIT_LEADER_POINTS",
      "GIVE_WARNING",
      "GIVE_REPRIMAND",
      "VIEW_DEPUTIES",
      "MANAGE_DEPUTIES",
      "VIEW_FACTIONS",
      "CREATE_FACTION",
      "EDIT_FACTION",
      "MANAGE_FACTION_MEMBERS",
      "VIEW_BUDGET",
      "MANAGE_BUDGET",
      "VIEW_ACTIVITY",
      "CREATE_GAME_ACTIVITY",
      "VIEW_LOGS",
      "CREATE_LOG",
      "VIEW_AUDIT_LOGS",
      "VIEW_NOTIFICATIONS",
      "MANAGE_NOTIFICATIONS",
      "VIEW_INTEGRATION",
      "MANAGE_ADMINS",
      "MANAGE_ROLES",
    ],
    sortOrder: 3,
  },

  ...supervisorRoles,

  {
    key: "administrator_level_4",
    name: "Administrator Level 4",
    description:
      "Senior site administrator: user moderation, leadership moderation, logs and audit access. Cannot appoint/dismiss leaders or touch budgets.",
    level: 45,
    category: "administration",
    managesAdminRoles: false,
    permissions: [
      "VIEW_DASHBOARD",
      "VIEW_USERS",
      "EDIT_USERS",
      "BLOCK_USERS",
      "VIEW_PROFILES",
      "EDIT_PROFILES",
      "VERIFY_GAME_ID",
      "VIEW_LEADERS",
      "EDIT_LEADER",
      "EDIT_LEADER_POINTS",
      "GIVE_WARNING",
      "GIVE_REPRIMAND",
      "VIEW_DEPUTIES",
      "VIEW_FACTIONS",
      "VIEW_BUDGET",
      "VIEW_ACTIVITY",
      "CREATE_GAME_ACTIVITY",
      "VIEW_LOGS",
      "CREATE_LOG",
      "VIEW_AUDIT_LOGS",
      "VIEW_NOTIFICATIONS",
      "MANAGE_NOTIFICATIONS",
    ],
    sortOrder: 300,
  },
  {
    key: "administrator_level_3",
    name: "Administrator Level 3",
    description:
      "Junior site administrator: read-mostly access with manual activity logging. No administration controls, no audit log.",
    level: 40,
    category: "administration",
    managesAdminRoles: false,
    permissions: [
      "VIEW_DASHBOARD",
      "VIEW_USERS",
      "VIEW_PROFILES",
      "VIEW_LEADERS",
      "VIEW_DEPUTIES",
      "VIEW_FACTIONS",
      "VIEW_BUDGET",
      "VIEW_ACTIVITY",
      "CREATE_GAME_ACTIVITY",
      "VIEW_LOGS",
      "CREATE_LOG",
      "VIEW_NOTIFICATIONS",
    ],
    sortOrder: 301,
  },
  {
    key: "player",
    name: "Player",
    description: "Default role for every newly registered user. No administrative access.",
    level: 0,
    category: "player",
    managesAdminRoles: false,
    permissions: ["VIEW_DASHBOARD", "VIEW_FACTIONS", "VIEW_LEADERS", "VIEW_DEPUTIES", "VIEW_NOTIFICATIONS"],
    sortOrder: 400,
  },
];

export const ROLE_MAP: Record<string, RoleDefinition> = Object.fromEntries(
  ROLE_DEFINITIONS.map((role) => [role.key, role]),
);

/** Roles allowed to manage administrative roles & critical permissions (spec §16). */
export const ADMIN_ROLE_MANAGEMENT_KEYS = [
  "site_founder",
  "chief_administrator",
  "deputy_chief_administrator",
  "curator",
] as const;

export const FOUNDER_ROLE_KEY = "site_founder";
