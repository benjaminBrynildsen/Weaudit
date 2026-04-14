import { storage } from "./server/storage";

async function findComRule() {
  const rules = await storage.listDowngradeRules();

  // Find rules with "COM" or "FLT" or "NFUEL"
  const matches = rules.filter(r =>
    r.name.includes("COM") ||
    r.name.includes("FLT") ||
    r.name.includes("NFUEL") ||
    r.name.includes("FLEET")
  );

  console.log(`Found ${matches.length} matching rules:\n`);

  for (const rule of matches) {
    console.log(`${rule.enabled ? "✓" : "✗"} ${rule.name} (${rule.brand})`);
    console.log(`  Keywords: [${rule.keywords.join(", ")}]`);
    console.log(`  Rate: ${rule.rate}% → Target: ${rule.targetRate}%`);
    console.log(``);
  }

  // Test if the line matches
  const testLine = "MC-COM DATA RATE I FLT NFUEL";
  console.log(`\nTest line: "${testLine}"\n`);

  const exactMatch = rules.find(r => r.name === "COM DATA RATE 1 FLT NFUEL");
  if (exactMatch) {
    console.log(`Exact match found: ${exactMatch.name}`);
    console.log(`  Keywords: [${exactMatch.keywords.join(", ")}]`);
    console.log(`  Brand: ${exactMatch.brand}`);
    console.log(`  Enabled: ${exactMatch.enabled}`);
    console.log(`  Rate: ${exactMatch.rate}% → Target: ${exactMatch.targetRate}%`);
  }
}

findComRule()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
