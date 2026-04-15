import { storage } from "./server/storage";

async function verifyKeywords() {
  console.log("Fetching downgrade rules...\n");

  const rules = await storage.listDowngradeRules();

  // Find a few example rules to showcase the enhancement
  const examples = [
    "Business T1 Product 1",
    "BUS LEVEL 5 DATA RATE 1",
    "PURCHASING Product 1",
  ];

  for (const ruleName of examples) {
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      console.log(`✓ ${rule.name}`);
      console.log(`  Keywords: ${rule.keywords.join(", ")}`);
      console.log(`  Total keywords: ${rule.keywords.length}`);
      console.log("");
    }
  }

  // Count how many rules have enhanced keywords
  const enhancedCount = rules.filter(r => {
    // If rule has variants like "TR1", "TIER1", "PRD", "LVL", etc., it's enhanced
    return r.keywords.some(kw =>
      /TR\d|TIER\d|PRD|PROD|LVL|L\d|DATA RT|DT RT|COMM|COMML|PUR|PURCH|CNP|CPS|STD|QUAL/i.test(kw)
    );
  }).length;

  console.log(`\n📊 Summary:`);
  console.log(`  Total rules: ${rules.length}`);
  console.log(`  Enhanced rules: ${enhancedCount}`);
  console.log(`  Percentage: ${((enhancedCount / rules.length) * 100).toFixed(1)}%`);
}

verifyKeywords()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
