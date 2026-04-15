import { storage } from "./server/storage";

async function checkRuleKeywords() {
  const rules = await storage.listDowngradeRules();

  // Find rules that should match the Superior Fastener lines
  const targetRules = [
    "Business T1 Product 1",
    "Business T3 Product 1",
    "Business T4 Product 1",
    "Business T5 Product 1",
  ];

  for (const ruleName of targetRules) {
    const rule = rules.find(r => r.name === ruleName && r.brand === "V");
    if (rule) {
      console.log(`\n✓ ${rule.name} (${rule.enabled ? "ENABLED" : "DISABLED"})`);
      console.log(`  Keywords: [${rule.keywords.join(", ")}]`);
      console.log(`  Total: ${rule.keywords.length}`);

      // Test if these keywords would match our test line
      const testLine = "VISA BUS T1 PRODUCT 1";
      const allMatch = rule.keywords.every(kw => testLine.toUpperCase().includes(kw.toUpperCase()));
      console.log(`  Would match "${testLine}": ${allMatch ? "YES" : "NO"}`);

      if (!allMatch) {
        console.log(`  Missing keywords:`);
        rule.keywords.forEach(kw => {
          if (!testLine.toUpperCase().includes(kw.toUpperCase())) {
            console.log(`    - "${kw}"`);
          }
        });
      }
    } else {
      console.log(`\n❌ Rule not found: ${ruleName}`);
    }
  }
}

checkRuleKeywords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
