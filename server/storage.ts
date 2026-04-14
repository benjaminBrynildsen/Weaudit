/**
 * Storage backend selector.
 *
 * The rest of the app imports `storage` from here and calls methods on it
 * — it does not know (and must not care) which backend is active.
 *
 * Selection rules:
 *   - DB_BACKEND=postgres  → PostgresStorage (requires DATABASE_URL)
 *   - DB_BACKEND=dynamo    → DynamoStorage  (default; matches existing
 *                             local/docker setup)
 *   - anything else        → DynamoStorage
 *
 * Re-exports all domain types from storage-types.ts so existing imports
 * like `import { Audit } from "./storage"` keep working.
 */

import { DynamoStorage } from "./db/storage-dynamo";
import { PostgresStorage } from "./db/storage-postgres";
import type { IStorage } from "./storage-types";

export * from "./storage-types";

export type StorageBackend = "dynamo" | "postgres";

export function getBackend(): StorageBackend {
  const raw = (process.env.DB_BACKEND || "dynamo").toLowerCase();
  return raw === "postgres" ? "postgres" : "dynamo";
}

function buildStorage(): IStorage {
  const backend = getBackend();
  if (backend === "postgres") {
    return new PostgresStorage();
  }
  return new DynamoStorage();
}

export const storage: IStorage = buildStorage();

// Re-export the concrete classes in case tests or scripts want to
// instantiate a specific backend explicitly.
export { DynamoStorage, PostgresStorage };
