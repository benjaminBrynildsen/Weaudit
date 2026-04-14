import { storage } from "./server/storage";

async function checkCorpKeywords() {
  const rules = await storage.listDowngradeRules();

  // Find both CORP variants
  const corpRule = rules.find(r => r.name === "CORP DATA RATE I (US) CORP" && r.brand === "M");
  const busRule = rules.find(r => r.name === "CORP DATA RATE I (US) BUS" && r.brand === "M");

  console.log("CORP DATA RATE I (US) CORP:");
  console.log(`  Keywords: [${corpRule?.keywords.join(", ")}]`);
  console.log(`  Enabled: ${corpRule?.enabled}\n`);

  console.log("CORP DATA RATE I (US) BUS:");
  console.log(`  Keywords: [${busRule?.keywords.join(", ")}]`);
  console.log(`  Enabled: ${busRule?.enabled}\n`);

  // Test line
  const testLine = "MC CORP DATA RATE 1 US BUS";
  console.log(`Test line: "${testLine}"\n`);

  if (corpRule) {
    const corpMatch = corpRule.keywords.every(kw => testLine.includes(kw));
    console.log(`CORP rule match: ${corpMatch ? "YES" : "NO"}`);
    corpRule.keywords.forEach(kw => {
      console.log(`  "${kw}": ${testLine.includes(kw) ? "✓" : "✗"}`);
    });
  }

  console.log("");

  if (busRule) {
    const busMatch = busRule.keywords.every(kw => testLine.includes(kw));
    console.log(`BUS rule match: ${busMatch ? "YES" : "NO"}`);
    busRule.keywords.forEach(kw => {
      console.log(`  "${kw}": ${testLine.includes(kw) ? "✓" : "✗"}`);
    });
  }
}

checkCorpKeywords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
