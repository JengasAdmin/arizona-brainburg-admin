import type { PermissionKey } from "./permissions";

/** Supervision areas (directions) — scoped roles only act inside their own area. */
export const DEPARTMENTS = [
  {
    key: "state_structures",
    name: "Госструктуры",
    description: "Правительственные и правоохранительные фракции.",
  },
  {
    key: "central_management",
    name: "Центральное управление",
    description: "Административный аппарат: СМИ и лицензирование.",
  },
  {
    key: "ministry_of_justice",
    name: "Министерство юстиции",
    description: "Направление юстиции (расширяемо — можно подключать новые фракции).",
  },
  {
    key: "healthcare",
    name: "Здравоохранение",
    description: "Медцентры, академия здравоохранения и пожарно-спасательная служба.",
  },
  {
    key: "max_prison",
    name: "Тюрьма особого режима",
    description: "Тюрьма особого режима Лас-Вентурас.",
  },
  {
    key: "ministry_of_defense",
    name: "Министерство обороны",
    description: "Армейские фракции.",
  },
  {
    key: "ghetto",
    name: "Гетто",
    description: "Направление «Гетто» (зарезервировано под будущие фракции).",
  },
  {
    key: "mafia",
    name: "Мафия",
    description: "Направление «Мафия» (зарезервировано под будущие фракции).",
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
  { dept: "state_structures", short: "state", label: "Госструктуры" },
  { dept: "central_management", short: "central", label: "Центральное управление" },
  { dept: "ministry_of_justice", short: "justice", label: "Министерство юстиции" },
  { dept: "healthcare", short: "health", label: "Здравоохранение" },
  { dept: "max_prison", short: "prison", label: "Тюрьма особого режима" },
  { dept: "ministry_of_defense", short: "defense", label: "Министерство обороны" },
  { dept: "ghetto", short: "ghetto", label: "Гетто" },
  { dept: "mafia", short: "mafia", label: "Мафия" },
];

const TIERS = [
  { tier: "chief" as const, suffix: "chief", label: (l: string) => `Старший куратор — ${l}`, level: 70 },
  {
    tier: "deputy_chief" as const,
    suffix: "deputy_chief",
    label: (l: string) => `Заместитель старшего куратора — ${l}`,
    level: 66,
  },
  { tier: "senior" as const, suffix: "senior", label: (l: string) => `Ведущий куратор — ${l}`, level: 62 },
  {
    tier: "supervisor" as const,
    suffix: "supervisor",
    label: (l: string) => `Куратор — ${l}`,
    level: 58,
  },
];

const supervisorRoles: RoleDefinition[] = SUPERVISOR_DEPARTMENTS.flatMap((d, deptIndex) =>
  TIERS.map((t, tierIndex) => ({
    key: `sup_${d.short}_${t.suffix}`,
    name: t.label(d.label),
    description: `${t.label(d.label)} — действует только в направлении «${d.label}».`,
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
    name: "Основатель сайта / Разработчик",
    description:
      "Абсолютный системный уровень. Полный доступ ко всем модулям, ролям, разрешениям, бюджету, журналам и настройкам.",
    level: 100,
    category: "administration",
    managesAdminRoles: true,
    permissions: ALL_PERMISSIONS,
    sortOrder: 0,
  },
  {
    key: "chief_administrator",
    name: "Главный администратор",
    description:
      "Высший административный уровень после основателя. Управляет администраторами, ролями, разрешениями и системой.",
    level: 90,
    category: "administration",
    managesAdminRoles: true,
    permissions: ALL_PERMISSIONS,
    sortOrder: 1,
  },
  {
    key: "deputy_chief_administrator",
    name: "Заместитель главного администратора",
    description:
      "Управляет администраторами, ролями и разрешениями. Глобальные системные настройки и ключи интеграции остаются за главным администратором и основателем.",
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
    name: "Куратор",
    description:
      "Управляет администраторами и ролями строго ниже собственного уровня. Не может изменять наборы разрешений и системные настройки.",
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
    name: "Администратор 4 уровня",
    description:
      "Старший администратор сайта: модерация пользователей и руководства, журналы и аудит. Не может назначать и отстранять руководителей, не работает с бюджетами.",
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
    name: "Администратор 3 уровня",
    description:
      "Младший администратор сайта: доступ преимущественно для чтения с ручным ведением активности. Без административных прав и журнала аудита.",
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
    name: "Игрок",
    description: "Роль по умолчанию для каждого нового пользователя. Без административного доступа.",
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
