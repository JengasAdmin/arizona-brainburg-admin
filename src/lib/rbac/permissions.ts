/**
 * Permission catalog — the single source of truth for RBAC.
 * Seeded into the `permissions` table by `scripts/seed.ts`.
 *
 * `scoped: true`  → the permission may be granted to a department-scoped role
 *                   (specialized supervisors only act inside their own direction).
 * `critical: true`→ only Site Founder / Chief Administrator / Deputy Chief
 *                   Administrator / Curator may hold or grant it.
 */
export interface PermissionDefinition {
  key: PermissionKey;
  name: string;
  group:
    | "Dashboard"
    | "Users"
    | "Leadership"
    | "Deputies"
    | "Factions"
    | "Budget"
    | "Activity"
    | "Logs"
    | "Notifications"
    | "Administration"
    | "System"
    | "Integration";
  description: string;
  scoped: boolean;
  critical: boolean;
}

export const PERMISSION_KEYS = [
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
  "DELETE_FACTION",
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
  "MANAGE_ADMINS",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
  "SYSTEM_SETTINGS",
  "VIEW_INTEGRATION",
  "MANAGE_INTEGRATION",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const p = (
  key: PermissionKey,
  name: string,
  group: PermissionDefinition["group"],
  description: string,
  opts: Partial<Pick<PermissionDefinition, "scoped" | "critical">> = {},
): PermissionDefinition => ({
  key,
  name,
  group,
  description,
  scoped: opts.scoped ?? true,
  critical: opts.critical ?? false,
});

export const PERMISSIONS: PermissionDefinition[] = [
  p("VIEW_DASHBOARD", "View dashboard", "Dashboard", "Open the administration dashboard.", {
    scoped: false,
  }),
  p("VIEW_USERS", "View users", "Users", "See the user list and filters."),
  p("EDIT_USERS", "Edit users", "Users", "Change profile data, status and Game ID."),
  p("BLOCK_USERS", "Block users", "Users", "Suspend or block user accounts."),
  p("VIEW_PROFILES", "View profiles", "Users", "Open full user profiles."),
  p("EDIT_PROFILES", "Edit profiles", "Users", "Edit nicknames, branches and profile fields."),
  p("VERIFY_GAME_ID", "Verify Game ID", "Users", "Confirm a user's Arizona RP Game ID."),

  p("VIEW_LEADERS", "View leaders", "Leadership", "See leadership positions and terms."),
  p("APPOINT_LEADER", "Appoint leader", "Leadership", "Create a new leadership term."),
  p("DISMISS_LEADER", "Dismiss leader", "Leadership", "Close an active leadership term."),
  p("EDIT_LEADER", "Edit leader", "Leadership", "Edit rank and details of a term."),
  p("EDIT_LEADER_POINTS", "Manage leadership points", "Leadership", "Add or remove leadership points."),
  p("GIVE_WARNING", "Issue warning", "Leadership", "Issue a warning to a leader/deputy."),
  p("GIVE_REPRIMAND", "Issue reprimand", "Leadership", "Issue a reprimand to a leader/deputy."),

  p("VIEW_DEPUTIES", "View deputies", "Deputies", "See deputy terms and history."),
  p("MANAGE_DEPUTIES", "Manage deputies", "Deputies", "Appoint and dismiss deputies."),

  p("VIEW_FACTIONS", "View factions", "Factions", "See all factions."),
  p("CREATE_FACTION", "Create faction", "Factions", "Create new factions."),
  p("EDIT_FACTION", "Edit faction", "Factions", "Edit faction data and positions."),
  p("DELETE_FACTION", "Delete faction", "Factions", "Delete a faction (critical).", {
    critical: true,
  }),
  p("MANAGE_FACTION_MEMBERS", "Manage faction members", "Factions", "Change faction membership."),

  p("VIEW_BUDGET", "View budget", "Budget", "See faction budgets and transactions."),
  p("MANAGE_BUDGET", "Manage budget", "Budget", "Create deposits and withdrawals (critical ledger).", {
    critical: true,
  }),

  p("VIEW_ACTIVITY", "View activity", "Activity", "See manual and integration game activity."),
  p("CREATE_GAME_ACTIVITY", "Create game activity", "Activity", "Record manual game activity."),

  p("VIEW_LOGS", "View logs", "Logs", "Read activity logs inside a scope."),
  p("CREATE_LOG", "Create log entry", "Logs", "Write manual log entries."),
  p("VIEW_AUDIT_LOGS", "View audit logs", "Logs", "Read the immutable audit log (critical).", {
    critical: true,
  }),

  p("VIEW_NOTIFICATIONS", "View notifications", "Notifications", "Read own notifications.", {
    scoped: false,
  }),
  p("MANAGE_NOTIFICATIONS", "Send notifications", "Notifications", "Send system notifications.", {
    scoped: false,
  }),

  p("MANAGE_ADMINS", "Manage administrators", "Administration", "Assign administrative roles (critical).", {
    scoped: false,
    critical: true,
  }),
  p("MANAGE_ROLES", "Manage roles", "Administration", "Create/assign roles within hierarchy (critical).", {
    scoped: false,
    critical: true,
  }),
  p("MANAGE_PERMISSIONS", "Manage permissions", "Administration", "Edit role permission sets (critical).", {
    scoped: false,
    critical: true,
  }),
  p("SYSTEM_SETTINGS", "System settings", "System", "Change global system settings (critical).", {
    scoped: false,
    critical: true,
  }),

  p("VIEW_INTEGRATION", "View integration", "Integration", "See integration status and API keys.", {
    scoped: false,
  }),
  p("MANAGE_INTEGRATION", "Manage integration", "Integration", "Create/disable integration API keys (critical).", {
    scoped: false,
    critical: true,
  }),
];

export const PERMISSION_MAP: Record<PermissionKey, PermissionDefinition> = Object.fromEntries(
  PERMISSIONS.map((perm) => [perm.key, perm]),
) as Record<PermissionKey, PermissionDefinition>;

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}
