/**
 * Export every DynamoDB table used by Weaudit to local JSON files.
 *
 * Why: before migrating to Postgres, take a full snapshot of production
 * data so nothing can be lost. These JSON files become the input to
 * `script/import-to-postgres.ts` during migration, and also serve as a
 * rollback if anything goes sideways.
 *
 * Usage:
 *   AWS_REGION=us-east-1 \
 *   AWS_ACCESS_KEY_ID=... \
 *   AWS_SECRET_ACCESS_KEY=... \
 *   DYNAMODB_ENDPOINT= \
 *   npx tsx script/export-dynamo.ts
 *
 * Leave DYNAMODB_ENDPOINT empty (or unset) to hit real AWS DynamoDB.
 * Set it to http://localhost:8000 to hit a local DynamoDB.
 *
 * Output: backups/<ISO-timestamp>/<table>.json, plus a manifest.json
 * summarizing row counts per table.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const TABLES = [
  "weaudit-audits",
  "weaudit-statements",
  "weaudit-findings",
  "weaudit-downgrade-rules",
  "weaudit-processor-isos",
  "weaudit-unknown-fees",
  "weaudit-notices",
  "weaudit-companies",
];

function buildClient() {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const raw = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    ...(endpoint ? { endpoint } : {}),
    ...(endpoint
      ? {
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
          },
        }
      : {}),
  });
  return DynamoDBDocumentClient.from(raw);
}

async function scanAll(ddb: DynamoDBDocumentClient, tableName: string) {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;

  do {
    const res: any = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const item of res.Items || []) items.push(item);
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function main() {
  const ddb = buildClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(process.cwd(), "backups", timestamp);
  await mkdir(outDir, { recursive: true });

  console.log(`\nExporting to ${outDir}\n`);

  const manifest: Record<string, { count: number; file: string; error?: string }> = {};

  for (const table of TABLES) {
    process.stdout.write(`  ${table}... `);
    try {
      const items = await scanAll(ddb, table);
      const file = `${table}.json`;
      await writeFile(join(outDir, file), JSON.stringify(items, null, 2), "utf-8");
      manifest[table] = { count: items.length, file };
      console.log(`${items.length} rows`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      manifest[table] = { count: 0, file: "", error: msg };
      console.log(`FAILED — ${msg}`);
    }
  }

  await writeFile(
    join(outDir, "manifest.json"),
    JSON.stringify(
      { exportedAt: new Date().toISOString(), tables: manifest },
      null,
      2,
    ),
    "utf-8",
  );

  console.log("\nDone. Summary:");
  for (const [name, info] of Object.entries(manifest)) {
    const status = info.error ? `ERROR: ${info.error}` : `${info.count} rows`;
    console.log(`  ${name.padEnd(30)} ${status}`);
  }
  console.log(`\nBackup directory: ${outDir}`);
}

main().catch((e) => {
  console.error("\nExport failed:", e);
  process.exit(1);
});
