import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

/**
 * Minimal, dependency-free SQL migration runner.
 *  - applies `migrations/*.sql` in filename order inside a transaction
 *  - records applied files in `schema_migrations`
 *  - works against Supabase (DIRECT_URL) and any local PostgreSQL
 *
 * Usage:
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate:status     show applied/pending
 */
async function main() {
  const statusOnly = process.argv.includes("--status");
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DIRECT_URL / DATABASE_URL is not set. Copy .env.example → .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRes = await pool.query("SELECT name FROM schema_migrations");
  const applied = new Set(appliedRes.rows.map((r) => r.name as string));

  if (statusOnly) {
    for (const file of files) {
      console.log(`${applied.has(file) ? "[applied]" : "[pending]"} ${file}`);
    }
    await pool.end();
    return;
  }

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = readFileSync(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ applied ${file}`);
      ran++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`✗ failed ${file}`);
      console.error(err);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }

  if (ran === 0) console.log("No pending migrations.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
