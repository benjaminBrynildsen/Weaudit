/**
 * Postgres client + Drizzle instance.
 *
 * Lazily created so this module can be imported even when DB_BACKEND=dynamo
 * without forcing a DATABASE_URL to exist. The pool is only opened the first
 * time `getDb()` is called.
 */

import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let _pool: Pool | undefined;
let _db: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Required when DB_BACKEND=postgres.",
    );
  }
  // Render-hosted Postgres uses a self-signed cert chain. Node rejects it
  // by default; relaxing here matches Render's official guidance.
  const useSSL = !/^(0|false)$/i.test(process.env.PGSSL ?? "1")
    && !/localhost|127\.0\.0\.1/.test(connectionString);
  _pool = new Pool({
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  });
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (_db) return _db;
  _db = drizzle(getPool(), { schema });
  return _db;
}

export { schema };
