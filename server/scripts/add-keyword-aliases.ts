import { storage } from "../storage";

/**
 * Generates abbreviation variants for a keyword
 * Example: "PRODUCT 1" → ["PRD 1", "PROD 1"]
 */
function generateKeywordVariants(keyword: string): string[] {
  const variants: string[] = [];

  // T1-5 variants
  const tierMatch = keyword.match(/\bT(\d+)\b/i);
  if (tierMatch) {
    const num = tierMatch[1];
    variants.push(keyword.replace(/\bT(\d+)\b/gi, `TR${num}`));
    variants.push(keyword.replace(/\bT(\d+)\b/gi, `TIER${num}`));
    variants.push(keyword.replace(/\bT(\d+)\b/gi, `TIER ${num}`));
  }

  // PRODUCT variants
  if (keyword.includes("PRODUCT")) {
    variants.push(keyword.replace(/PRODUCT/gi, "PRD"));
    variants.push(keyword.replace(/PRODUCT/gi, "PROD"));
  }

  // LEVEL variants
  if (keyword.includes("LEVEL")) {
    variants.push(keyword.replace(/LEVEL/gi, "LVL"));
    const levelMatch = keyword.match(/LEVEL\s*(\d+)/i);
    if (levelMatch) {
      variants.push(keyword.replace(/LEVEL\s*(\d+)/gi, `L${levelMatch[1]}`));
    }
  }

  // DATA RATE variants
  if (keyword.includes("DATA RATE")) {
    variants.push(keyword.replace(/DATA RATE/gi, "DATA RT"));
    variants.push(keyword.replace(/DATA RATE/gi, "DT RT"));
    variants.push(keyword.replace(/DATA RATE/gi, "DT RATE"));
  }

  // COMMERCIAL variants
  if (keyword.includes("COMMERCIAL")) {
    variants.push(keyword.replace(/COMMERCIAL/gi, "COMM"));
    variants.push(keyword.replace(/COMMERCIAL/gi, "COMML"));
  }

  // BUSINESS variants
  if (keyword.includes("BUSINESS")) {
    variants.push(keyword.replace(/BUSINESS/gi, "BUS"));
  }

  // CORPORATE variants
  if (keyword.includes("CORPORATE")) {
    variants.push(keyword.replace(/CORPORATE/gi, "CORP"));
  }

  // PURCHASING variants
  if (keyword.includes("PURCHASING")) {
    variants.push(keyword.replace(/PURCHASING/gi, "PUR"));
    variants.push(keyword.replace(/PURCHASING/gi, "PURCH"));
  }

  // CARD NOT PRESENT variants
  if (keyword.includes("CARD NOT PRESENT")) {
    variants.push(keyword.replace(/CARD NOT PRESENT/gi, "CNP"));
  }

  // CARD PRESENT variants
  if (keyword.includes("CARD PRESENT")) {
    variants.push(keyword.replace(/CARD PRESENT/gi, "CPS"));
  }

  // STANDARD variants
  if (keyword.includes("STANDARD")) {
    variants.push(keyword.replace(/STANDARD/gi, "STD"));
  }

  // QUALIFIED variants
  if (keyword.includes("QUALIFIED")) {
    variants.push(keyword.replace(/QUALIFIED/gi, "QUAL"));
  }

  // NON QUALIFIED variants
  if (keyword.includes("NON QUALIFIED")) {
    variants.push(keyword.replace(/NON QUALIFIED/gi, "NON QUAL"));
    variants.push(keyword.replace(/NON QUALIFIED/gi, "NONQUAL"));
    variants.push(keyword.replace(/NON QUALIFIED/gi, "NQUAL"));
  }

  // REGULATED variants
  if (keyword.includes("REGULATED")) {
    variants.push(keyword.replace(/REGULATED/gi, "REG"));
  }

  // UNREGULATED variants
  if (keyword.includes("UNREGULATED")) {
    variants.push(keyword.replace(/UNREGULATED/gi, "UNREG"));
  }

  // DOMESTIC variants
  if (keyword.includes("DOMESTIC")) {
    variants.push(keyword.replace(/DOMESTIC/gi, "DOM"));
    variants.push(keyword.replace(/DOMESTIC/gi, "DOMSTC"));
  }

  // INTERNATIONAL variants
  if (keyword.includes("INTERNATIONAL")) {
    variants.push(keyword.replace(/INTERNATIONAL/gi, "INTL"));
  }

  // SIGNATURE variants
  if (keyword.includes("SIGNATURE")) {
    variants.push(keyword.replace(/SIGNATURE/gi, "SIG"));
    variants.push(keyword.replace(/SIGNATURE/gi, "SIGN"));
  }

  // PREFERRED variants
  if (keyword.includes("PREFERRED")) {
    variants.push(keyword.replace(/PREFERRED/gi, "PREF"));
  }

  // REWARDS variants
  if (keyword.includes("REWARDS")) {
    variants.push(keyword.replace(/REWARDS/gi, "RWD"));
    variants.push(keyword.replace(/REWARDS/gi, "RWDS"));
  }

  // MERIT variants
  if (keyword.includes("MERIT")) {
    variants.push(keyword.replace(/MERIT/gi, "MRT"));
  }

  // Remove duplicates using an object map
  const uniqueMap: { [key: string]: boolean } = {};
  variants.forEach(v => uniqueMap[v] = true);
  return Object.keys(uniqueMap);
}

/**
 * Updates all downgrade rules to include keyword abbreviation variants
 */
async function addKeywordAliases() {
  console.log("Starting keyword alias enhancement...\n");

  const rules = await storage.listDowngradeRules();
  console.log(`Found ${rules.length} downgrade rules\n`);

  let updatedCount = 0;

  for (const rule of rules) {
    const originalKeywords = rule.keywords;
    const keywordMap: { [key: string]: boolean } = {};

    // Add original keywords
    originalKeywords.forEach(kw => keywordMap[kw] = true);

    // Generate variants for each keyword
    for (const keyword of originalKeywords) {
      const variants = generateKeywordVariants(keyword);
      variants.forEach(v => keywordMap[v] = true);
    }

    const newKeywords = Object.keys(keywordMap);

    // Only update if new keywords were added
    if (newKeywords.length > originalKeywords.length) {
      await storage.updateDowngradeRule(rule.ruleId, {
        keywords: newKeywords,
      });

      console.log(`✓ ${rule.name}`);
      console.log(`  Original: ${originalKeywords.join(", ")}`);
      console.log(`  Enhanced: ${newKeywords.join(", ")}`);
      console.log(`  Added ${newKeywords.length - originalKeywords.length} variants\n`);

      updatedCount++;
    }
  }

  console.log(`\nComplete! Updated ${updatedCount} rules with keyword aliases.`);
}

export { addKeywordAliases, generateKeywordVariants };

// Run if executed directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  addKeywordAliases()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
