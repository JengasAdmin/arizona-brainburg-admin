import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { factions } from "./factions";
import { users } from "./users";
import { departments } from "./rbac";

/** Manual (and later, integration-fed) in-game activity records. */
export const gameActivity = pgTable(
  "game_activity",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    factionId: integer("faction_id").references(() => factions.id, { onDelete: "set null" }),
    /** Promotion | Demotion | Transfer | Warning | Kick | Event | Custom … */
    action: text("action").notNull(),
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    /** manual | integration — integration rows are written by the game bot API. */
    source: text("source").notNull().default("manual"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("game_activity_user_idx").on(t.userId),
    index("game_activity_faction_idx").on(t.factionId),
    index("game_activity_occurred_idx").on(t.occurredAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** leader_appointed | leader_dismissed | position_changed | warning_received | … */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_user_unread_idx").on(t.userId, t.readAt),
  ],
);

/**
 * Immutable audit log. Immutability is enforced BOTH in the application layer AND
 * in the database (trigger rejects UPDATE/DELETE — see migrations).
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: text("actor_role"),
    action: text("action").notNull(), // DISMISS_LEADER, BUDGET_WITHDRAWAL, ROLE_ASSIGN …
    entityType: text("entity_type").notNull(), // user | leadership_term | faction | budget …
    entityId: text("entity_id"),
    targetLabel: text("target_label"), // human-readable target (nickname / faction / …)
    oldValue: jsonb("old_value").$type<unknown>(),
    newValue: jsonb("new_value").$type<unknown>(),
    reason: text("reason"),
    /** Stored only where technically justified; may be disabled via system settings. */
    ip: text("ip"),
    /** Department of the affected entity — used for scoped audit visibility. */
    departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

/** Key/value system settings — seed-provided, editable by SYSTEM_SETTINGS holders. */
export const systemSettings = pgTable(
  "system_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<unknown>().notNull(),
    description: text("description"),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * API keys for the future game-server / bot integration.
 * Only a SHA-256 hash of the key is stored — the plaintext is shown once at creation.
 */
export const integrationApiKeys = pgTable(
  "integration_api_keys",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(), // first chars, for display
    keyHash: text("key_hash").notNull().unique(), // sha256(key)
    /** permissions granted to the key, e.g. ["game:read","activity:write"] */
    scopes: text("scopes").array().notNull().default([]),
    /** active | disabled */
    status: text("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("integration_api_keys_prefix_uq").on(t.keyPrefix)],
);

/**
 * Per-user preferences (notification toggles, UI options).
 * Key/value JSON so new preferences never require a migration.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Non-sensitive payloads received from the future game bot (staging area). */
export const integrationEvents = pgTable(
  "integration_events",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().default("game_bot"),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("received"), // received | processed | rejected
    apiKeyId: integer("api_key_id").references(() => integrationApiKeys.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("integration_events_created_idx").on(t.createdAt)],
);
