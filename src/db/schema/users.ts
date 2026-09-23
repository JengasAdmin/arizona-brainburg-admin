import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { servers } from "./servers";

/**
 * Users — every registered account gets an immutable internal User ID (`User ID #N`).
 * Identity comes exclusively from OAuth (Discord / VK). No local passwords exist.
 */
export const users = pgTable(
  "users",
  {
    /** Internal User ID — immutable, shown as `User ID #N`. */
    id: serial("id").primaryKey(),

    displayName: text("display_name").notNull(),
    /** In-game nickname (Arizona RP), may be set by the user or an administrator. */
    nickname: text("nickname"),
    avatarUrl: text("avatar_url"),

    /** Arizona RP Game ID. May be self-declared; must be verified by an administrator. */
    gameId: text("game_id"),
    gameIdVerifiedAt: timestamp("game_id_verified_at", { withTimezone: true }),
    gameIdVerifiedBy: integer("game_id_verified_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),

    /** Server this player belongs to. Always 5 for this deployment. */
    serverId: integer("server_id")
      .notNull()
      .default(5)
      .references(() => servers.id, { onDelete: "set default" }),

    /** active | suspended | blocked | inactive */
    status: text("status").notNull().default("active"),
    statusReason: text("status_reason"),

    /** Free-form branch label shown on the profile, e.g. "Government / Law Enforcement". */
    branch: text("branch"),

    /** Where the account was first created. */
    registrationSource: text("registration_source").notNull().default("discord"), // discord | vk

    /** Bumping this value revokes every issued session token for the user. */
    tokenVersion: integer("token_version").notNull().default(0),

    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Game IDs are unique per server (NULLs never conflict in PostgreSQL).
    uniqueIndex("users_game_id_uq").on(t.gameId, t.serverId),
    index("users_status_idx").on(t.status),
    index("users_nickname_idx").on(t.nickname),
    index("users_display_name_idx").on(t.displayName),
  ],
);

/**
 * OAuth identities. One user may connect BOTH Discord and VK (account linking).
 * Provider tokens are intentionally NOT stored — only the public profile.
 */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** discord | vk */
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerUsername: text("provider_username"),
    providerDisplayName: text("provider_display_name"),
    providerAvatarUrl: text("provider_avatar_url"),
    /** Non-sensitive profile snapshot for debugging / display fallback. */
    profile: jsonb("profile").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("oauth_accounts_provider_user_uq").on(t.provider, t.providerAccountId),
    uniqueIndex("oauth_accounts_user_provider_uq").on(t.userId, t.provider),
    index("oauth_accounts_user_idx").on(t.userId),
  ],
);

export const usersRelations = undefined; // relations are declared in `relations.ts`
