import { storage } from "./server/storage";
import { setupTables } from "./server/db/setup";

async function showDowngrades() {
  await setupTables().catch(() => {});

  // Get all audits
  const audits = await storage.listAudits();
  if (audits.length === 0) {
    console.log("No audits found");
    return;
  }

  // Get the most recent audit
  const latestAudit = audits.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  console.log(`Audit: ${latestAudit.clientName} (${latestAudit.auditId})`);

  const findings = await storage.getFindingsByAudit(latestAudit.auditId);
  const downgrades = findings.filter(f => f.type === "downgrade");

  console.log(`\nTotal Downgrades: ${downgrades.length}\n`);

  downgrades.forEach((d, i) => {
    console.log(`${i + 1}. ${d.title}`);
    console.log(`   Amount: $${d.amount.toFixed(2)} | Rate: ${d.rate.toFixed(2)}% | Spread: $${d.spread?.toFixed(2) || 0}`);
    console.log(`   Page ${d.page}, Line ${d.lineNum}`);
    console.log(`   Raw: ${d.rawLine}`);
    console.log(`   Priority: ${d.priority}`);
    console.log();
  });

  // Check for duplicates
  const titleCounts = new Map<string, number>();
  downgrades.forEach(d => {
    titleCounts.set(d.title, (titleCounts.get(d.title) || 0) + 1);
  });

  console.log("\n=== Duplicate Check ===");
  for (const [title, count] of titleCounts.entries()) {
    if (count > 1) {
      console.log(`⚠️  "${title}" appears ${count} times`);
      const dups = downgrades.filter(d => d.title === title);
      dups.forEach(d => {
        console.log(`    - Page ${d.page}, Line ${d.lineNum}: $${d.amount.toFixed(2)} (Priority ${d.priority})`);
      });
    }
  }
}

showDowngrades().catch(console.error);
