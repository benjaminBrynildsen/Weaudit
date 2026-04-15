import { storage } from "./server/storage";
import { setupTables } from "./server/db/setup";

async function listAudits() {
  await setupTables().catch(() => {});

  const audits = await storage.listAudits();
  console.log(`Total audits in database: ${audits.length}\n`);

  for (const audit of audits) {
    const findings = await storage.getFindingsByAudit(audit.auditId);
    const downgrades = findings.filter(f => f.type === "downgrade");

    console.log(`${audit.clientName} (${audit.auditId.slice(0, 8)}...)`);
    console.log(`  Created: ${new Date(audit.createdAt).toLocaleString()}`);
    console.log(`  Status: ${audit.status}`);
    console.log(`  Downgrades: ${downgrades.length}`);

    if (downgrades.length > 0) {
      downgrades.forEach(d => {
        console.log(`    - ${d.title}: $${d.amount.toFixed(2)} (spread: $${d.spread?.toFixed(2) || 0})`);
      });
    }
    console.log();
  }
}

listAudits().catch(console.error);
