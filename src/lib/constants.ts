export const APP_NAME = "ARIZONA RP";
export const APP_SUBTITLE = "BRAINBURG";
export const SERVER_ID = 5;
export const SERVER_LABEL = `Server #${SERVER_ID}`;
export const APP_DESCRIPTION =
  "Closed leadership & administration management platform for Arizona RP — Brainburg, Server #5.";

export const USER_STATUSES = ["active", "suspended", "blocked", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TERM_STATUSES = ["active", "dismissed"] as const;
export type TermStatus = (typeof TERM_STATUSES)[number];

export const DISCIPLINARY_TYPES = ["warning", "reprimand"] as const;
export type DisciplinaryType = (typeof DISCIPLINARY_TYPES)[number];

export const BUDGET_TYPES = ["deposit", "withdrawal"] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export const GAME_ACTIVITY_ACTIONS = [
  "Promotion",
  "Demotion",
  "Transfer",
  "Warning",
  "Kick",
  "Event",
  "Custom",
] as const;

export const NOTIFICATION_TYPES = [
  "leader_appointed",
  "leader_dismissed",
  "position_changed",
  "warning_received",
  "reprimand_received",
  "points_changed",
  "game_id_verified",
  "role_changed",
  "account_blocked",
  "account_unblocked",
  "budget_changed",
  "system",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const INTEGRATION_STATUS_NOT_CONNECTED = "Not connected";
