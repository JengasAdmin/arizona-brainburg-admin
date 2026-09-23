/**
 * System settings catalog — pure data (importable by scripts, server and UI).
 */

export const DEFAULT_SETTINGS: Record<string, { value: unknown; description: string }> = {
  audit_store_ip: {
    value: true,
    description:
      "Store the actor's IP address in audit logs (privacy-sensitive — disable where not justified).",
  },
  allow_negative_budget: {
    value: false,
    description: "Allow faction budgets to drop below zero via withdrawals.",
  },
  allow_multiple_active_terms: {
    value: false,
    description: "Allow one user to hold active leader terms in several factions at once.",
  },
  registration_allowlist_enabled: {
    value: false,
    description: "Restrict sign-in to allowlisted Discord/VK IDs (env-driven ALLOWLIST_*).",
  },
  integration_enabled: {
    value: false,
    description:
      "Enable the future game-bot integration API. Off by default → status shows “Not connected”.",
  },
  maintenance_mode: {
    value: false,
    description: "Block non-administrative access while performing maintenance.",
  },
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

/** Per-user notification preferences — defaults applied when a row is missing. */
export const DEFAULT_USER_PREFERENCES: Record<string, boolean> = {
  notify_leader_events: true,
  notify_disciplinary: true,
  notify_points: true,
  notify_roles: true,
  notify_budget: true,
  notify_system: true,
  digest_unread_badge: true,
};
