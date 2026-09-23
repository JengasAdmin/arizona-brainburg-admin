import { defineConfig } from "drizzle-kit";

// Drizzle Kit config — SQL migrations are generated from the TypeScript schema
// and applied either locally (`npm run db:migrate`) or via the Supabase SQL editor.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
