import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { departments } from "./rbac";

/** Faction categories — extensible, seeded from the spec. */
export const factionCategories = pgTable(
  "faction_categories",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(), // government | law_enforcement | military | healthcare | media | licensing | corrections
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("faction_categories_key_uq").on(t.key)],
);

/** The 14 factions of Server #5 (extensible). */
export const factions = pgTable(
  "factions",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(), // stable slug, e.g. lspd
    name: text("name").notNull(), // "Los Santos Police Department"
    shortName: text("short_name").notNull(), // "LSPD"
    description: text("description"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => factionCategories.id, { onDelete: "restrict" }),
    /** Supervision area used for scoped RBAC (specialized supervisors). */
    departmentId: integer("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    /** active | inactive */
    status: text("status").notNull().default("active"),
    /** Business rule: allow more than one simultaneous active leader term. */
    allowMultipleLeaders: boolean("allow_multiple_leaders").notNull().default(false),
    /** Business rule: allow a single user to hold leader terms in several factions. */
    allowCrossFactionLeadership: boolean("allow_cross_faction_leadership")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("factions_key_uq").on(t.key), index("factions_department_idx").on(t.departmentId)],
);

/**
 * Named positions inside a faction (leader + deputy + ministerial positions).
 * Titles live in data, so renaming a position never requires a code change.
 */
export const factionPositions = pgTable(
  "faction_positions",
  {
    id: serial("id").primaryKey(),
    factionId: integer("faction_id")
      .notNull()
      .references(() => factions.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(), // stable slug, e.g. chief_of_lspd
    title: text("title").notNull(), // display title
    /** leader | deputy */
    kind: text("kind").notNull().default("leader"),
    /** Sort order on the faction page. */
    sortOrder: integer("sort_order").notNull().default(0),
    /** How many simultaneous active terms this position may hold (default 1). */
    maxActiveTerms: integer("max_active_terms").notNull().default(1),
    description: text("description"),
    status: text("status").notNull().default("active"), // active | inactive
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("faction_positions_faction_key_uq").on(t.factionId, t.key),
    index("faction_positions_faction_idx").on(t.factionId),
  ],
);
