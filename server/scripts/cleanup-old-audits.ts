import { storage } from "./server/storage";
import { setupTables } from "./server/db/setup";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_AUDITS, TABLE_FINDINGS, TABLE_STATEMENTS, TABLE_UNKNOWN_FEES, TABLE_NOTICES } from "./server/db/client";

async function cleanup() {
  await setupTables().catch(() => {});

  const audits = await storage.listAudits();
  console.log(`Total audits: ${audits.length}\n`);

  // Sort by creation date
  const sorted = audits.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Keep only the most recent audit
  const toKeep = sorted.slice(-1);
  const toDelete = sorted.slice(0, -1);

  console.log(`Keeping most recent audit:`);
  for (const audit of toKeep) {
    console.log(`  ✓ ${audit.clientName} (${new Date(audit.createdAt).toLocaleString()})`);
  }

  console.log(`\nDeleting ${toDelete.length} old test audits...`);

  for (const audit of toDelete) {
    console.log(`  🗑️  ${audit.clientName} (${new Date(audit.createdAt).toLocaleString()})`);

    // Delete associated findings
    const findings = await storage.getFindingsByAudit(audit.auditId);
    for (const finding of findings) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE_FINDINGS,
        Key: { findingId: finding.findingId },
      }));
    }

    // Delete associated statements
    const statements = await storage.getStatementsByAudit(audit.auditId);
    for (const stmt of statements) {
      await ddb.send(new DeleteCommand({
        TableName: TABLE_STATEMENTS,
        Key: { statementId: stmt.statementId },
      }));
    }

    // Delete unknown fees (if any)
    // Note: Would need to query by auditId first, skipping for now

    // Delete notices (if any)
    // Note: Would need to query by auditId first, skipping for now

    // Delete the audit itself
    await ddb.send(new DeleteCommand({
      TableName: TABLE_AUDITS,
      Key: { auditId: audit.auditId },
    }));
  }

  console.log(`\n✅ Cleanup complete! Kept 1 audit, deleted ${toDelete.length} old audits.`);
}

cleanup().catch(console.error);
