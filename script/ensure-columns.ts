/**
 * Idempotent column sync for Postgres.
 *
 * `drizzle-kit push --force` is the primary schema sync on Render, but it
 * has been observed to silently skip adding new nullable columns on some
 * deploys — leaving the app to crash at runtime with "column X of relation
 * Y does not exist". This script is a belt-and-suspenders fallback: it
 * applies `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for every column that
 * was added after the initial schema was pushed, so the app always boots
 * against a DB that has everything it needs.
 *
 * Safe to run on every deploy. Append new entries here whenever the
 * Drizzle schema gains a column.
 */

import { Pool } from "pg";

const statements: string[] = [
  `ALTER TABLE IF EXISTS audits ADD COLUMN IF NOT EXISTS error_message text`,
  `ALTER TABLE IF EXISTS findings ADD COLUMN IF NOT EXISTS transaction_count integer`,
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to ensure columns.");
  }

  const useSSL = !/localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  });

  for (const sql of statements) {
    console.log(`  ${sql}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log("Column sync complete.");
}

main().catch((e) => {
  console.error("Column sync failed:", e);
  process.exit(1);
});
