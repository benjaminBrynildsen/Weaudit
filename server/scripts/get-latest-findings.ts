import { storage } from "./server/storage";

async function getLatestFindings() {
  // Get the most recent audit
  const audits = await storage.listAudits();
  const latestAudit = audits.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (!latestAudit) {
    console.log("No audits found");
    return;
  }

  console.log(`Latest audit: ${latestAudit.clientName}`);
  console.log(`Created: ${latestAudit.createdAt}\n`);

  // Get findings for this audit
  const auditFindings = await storage.getFindingsByAudit(latestAudit.auditId);

  const downgrades = auditFindings.filter(f => f.type === "downgrade");

  console.log(`Total findings: ${auditFindings.length}`);
  console.log(`Downgrades: ${downgrades.length}\n`);

  console.log("Downgrade Findings:");
  console.log("=".repeat(80));

  downgrades
    .sort((a, b) => (b.spread || 0) - (a.spread || 0))
    .forEach((d, i) => {
      console.log(`\n${i + 1}. ${d.title}`);
      console.log(`   Volume: $${d.amount.toFixed(2)}`);
      console.log(`   Rate: ${d.rate.toFixed(2)}% → Target: ${d.targetRate?.toFixed(2)}%`);
      console.log(`   Revenue Lost: $${(d.spread || 0).toFixed(2)}`);
      console.log(`   Raw: ${d.rawLine.substring(0, 60)}...`);
    });

  console.log("\n" + "=".repeat(80));
  console.log(`\nTotal: ${downgrades.length} downgrades found`);
}

getLatestFindings()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
