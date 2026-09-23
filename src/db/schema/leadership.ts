import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { factions, factionPositions } from "./factions";
import { users } from "./users";

/**
 * Leadership Terms — an appointment is NEVER overwritten.
 * Every (re)appointment creates a brand-new Term row; dismissal only closes the open one.
 *
 * Deputies are modeled the same way: a Term whose position `kind = 'deputy'`.
 * This keeps a single source of truth for appointment history (see README §Architecture).
 */
export const leadershipTerms = pgTable(
  "leadership_terms",
  {
    id: serial("id").primaryKey(),
    /** Term #N within the position — never reused. */
    termNumber: integer("term_number").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    factionId: integer("faction_id")
      .notNull()
      .references(() => factions.id, { onDelete: "restrict" }),
    positionId: integer("position_id")
      .notNull()
      .references(() => factionPositions.id, { onDelete: "restrict" }),
    /** Rank inside the faction at appointment time (snapshot, may be edited later). */
    rank: integer("rank").notNull().default(1),
    rankLabel: text("rank_label"),

    appointedAt: date("appointed_at").notNull().defaultNow(),
    appointmentReason: text("appointment_reason").notNull(),
    appointedBy: integer("appointed_by").references(() => users.id, { onDelete: "set null" }),

    /** Set when the term is closed. The historical row is never deleted. */
    dismissedAt: date("dismissed_at"),
    dismissalReason: text("dismissal_reason"),
    dismissedBy: integer("dismissed_by").references(() => users.id, { onDelete: "set null" }),

    /** active | dismissed */
    status: text("status").notNull().default("active"),

    /** Current points — every change is mirrored in leadership_points_history. */
    leadershipPoints: integer("leadership_points").notNull().default(0),
    warningsCount: integer("warnings_count").notNull().default(0),
    reprimandsCount: integer("reprimands_count").notNull().default(0),

    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("leadership_terms_position_number_uq").on(t.positionId, t.termNumber),
    index("leadership_terms_user_idx").on(t.userId),
    index("leadership_terms_faction_status_idx").on(t.factionId, t.status),
    index("leadership_terms_position_status_idx").on(t.positionId, t.status),
  ],
);

/** Append-only history of leadership point changes (old → new, with reason). */
export const leadershipPointsHistory = pgTable(
  "leadership_points_history",
  {
    id: serial("id").primaryKey(),
    termId: integer("term_id")
      .notNull()
      .references(() => leadershipTerms.id, { onDelete: "restrict" }),
    oldValue: integer("old_value").notNull(),
    newValue: integer("new_value").notNull(),
    difference: integer("difference").notNull(),
    reason: text("reason").notNull(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leadership_points_history_term_idx").on(t.termId)],
);

/**
 * Warnings & reprimands for leaders/deputies — a single append-only table filtered by
 * `type` (identical structure, single service, no duplicated history).
 */
export const disciplinaryActions = pgTable(
  "disciplinary_actions",
  {
    id: serial("id").primaryKey(),
    /** warning | reprimand */
    type: text("type").notNull(),
    termId: integer("term_id")
      .notNull()
      .references(() => leadershipTerms.id, { onDelete: "restrict" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    issuedBy: integer("issued_by").references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("disciplinary_actions_term_idx").on(t.termId),
    index("disciplinary_actions_user_idx").on(t.userId),
    index("disciplinary_actions_type_idx").on(t.type),
  ],
);
