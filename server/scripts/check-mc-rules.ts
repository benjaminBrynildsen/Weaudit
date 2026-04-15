import { storage } from "./server/storage";

async function checkMCRules() {
  const rules = await storage.listDowngradeRules();

  // Find Mastercard CORP DATA RATE rules
  const mcRules = rules.filter(r =>
    r.brand === "M" &&
    (r.name.includes("CORP DATA RATE") || r.name.includes("CORPORATE"))
  );

  console.log(`Found ${mcRules.length} Mastercard CORP/DATA RATE rules:\n`);

  for (const rule of mcRules) {
    console.log(`${rule.enabled ? "✓" : "✗"} ${rule.name}`);
    console.log(`  Keywords: [${rule.keywords.join(", ")}]`);
    console.log(``);
  }

  // Also check the Non-Qual Purch Data rule
  const nqRule = rules.find(r => r.name === "Non-Qual Purch Data");
  if (nqRule) {
    console.log(`\nNon-Qual Purch Data rule:`);
    console.log(`  Keywords: [${nqRule.keywords.join(", ")}]`);
    console.log(`  Brand: ${nqRule.brand}`);
  }

  // Test if line would match
  const testLine = "MC-CORP DATA RATE I (US) BUS";
  console.log(`\n\nTest line: "${testLine}"`);
  console.log(`Should match a Mastercard CORP DATA RATE rule\n`);
}

checkMCRules()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
