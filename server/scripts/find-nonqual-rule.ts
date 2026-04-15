import { storage } from "./server/storage";

async function findNonQualRule() {
  const rules = await storage.listDowngradeRules();

  // Find NON QUAL rules
  const matches = rules.filter(r =>
    r.name.includes("Non-Qual") ||
    r.name.includes("NON QUAL")
  );

  console.log(`Found ${matches.length} Non-Qual rules:\n`);

  for (const rule of matches) {
    console.log(`${rule.enabled ? "✓" : "✗"} ${rule.name} (${rule.brand})`);
    console.log(`  Keywords: [${rule.keywords.join(", ")}]`);
    console.log(`  Rate: ${rule.rate}% → Target: ${rule.targetRate}%`);
    console.log(``);
  }

  // Test line
  const testLine = "VI-NON QUAL BUS CR";
  console.log(`\nTest line: "${testLine}"\n`);

  // Find which rule would match
  const busRule = rules.find(r =>
    r.name === "Non-Qual Business Credit" ||
    r.name === "Non-Qual Bus Credit"
  );

  if (busRule) {
    console.log(`Match: ${busRule.name}`);
    console.log(`  Keywords: [${busRule.keywords.join(", ")}]`);
    console.log(`  Brand: ${busRule.brand}`);
    console.log(`  Enabled: ${busRule.enabled}`);
    console.log(`  Rate: ${busRule.rate}% → Target: ${busRule.targetRate}%`);

    // Check if keywords match
    const lineUpper = testLine.toUpperCase();
    const allMatch = busRule.keywords.every(kw => lineUpper.includes(kw.toUpperCase()));
    console.log(`\n  Would match: ${allMatch ? "YES" : "NO"}`);
    busRule.keywords.forEach(kw => {
      console.log(`    "${kw}": ${lineUpper.includes(kw.toUpperCase()) ? "✓" : "✗"}`);
    });
  }
}

findNonQualRule()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
