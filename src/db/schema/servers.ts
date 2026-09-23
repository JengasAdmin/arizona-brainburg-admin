import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/** Game servers this platform manages. Seeded with Server #5. */
export const servers = pgTable(
  "servers",
  {
    id: serial("id").primaryKey(),
    serverNumber: integer("server_number").notNull().unique(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("Europe/Moscow"),
    status: text("status").notNull().default("active"), // active | inactive
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("servers_number_uq").on(t.serverNumber)],
);
