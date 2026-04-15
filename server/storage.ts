/**
 * Storage backend — Postgres only (Render-hosted).
 *
 * Re-exports all domain types from storage-types.ts so existing imports
 * like `import { Audit } from "./storage"` keep working.
 */

import { PostgresStorage } from "./db/storage-postgres";
import type { IStorage } from "./storage-types";

export * from "./storage-types";

export const storage: IStorage = new PostgresStorage();

export { PostgresStorage };
