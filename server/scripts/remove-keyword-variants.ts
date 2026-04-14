import { storage } from "../storage";

/**
 * Remove keyword variants that were incorrectly added
 * The abbreviation expansion creates LINE variants, not keyword variants
 * Rules should only have the base/normalized keywords
 */
async function removeKeywordVariants() {
  console.log("Removing incorrectly added keyword variants...\n");

  const rules = await storage.listDowngradeRules();
  console.log(`Found ${rules.length} downgrade rules\n`);

  let updatedCount = 0;

  for (const rule of rules) {
    const originalKeywords = rule.keywords;

    // Filter out variant keywords, keep only base keywords
    const baseKeywords = originalKeywords.filter(kw => {
      const upper = kw.toUpperCase();

      // Remove TR1-5, TIER1-5, TIER 1-5 variants (keep only T1-5)
      if (/^TR\d+$/.test(upper)) return false;
      if (/^TIER\s*\d+$/.test(upper)) return false;

      // Remove PRD, PROD variants (keep only PRODUCT)
      if (upper === "PRD" || upper === "PROD") return false;
      if (/^PRD\s+\d+$/.test(upper)) return false;
      if (/^PROD\s+\d+$/.test(upper)) return false;

      // Remove LVL, L{N} variants (keep only LEVEL)
      if (upper === "LVL") return false;
      if (/^L\d+$/.test(upper)) return false;
      if (/^LVL\s+\d+$/.test(upper)) return false;

      // Remove DATA RT, DT RT, DT RATE variants (keep only DATA RATE)
      if (upper === "DATA RT" || upper === "DT RT" || upper === "DT RATE") return false;
      if (/^DATA RT\s+\d+$/i.test(upper)) return false;
      if (/^DT RT\s+\d+$/i.test(upper)) return false;
      if (/^DT RATE\s+\d+$/i.test(upper)) return false;

      // Remove abbreviation variants, keep full forms
      if (upper === "COMM" || upper === "COMML") return false;
      if (upper === "PUR" || upper === "PURCH") return false;
      if (upper === "CNP") return false;
      if (upper === "CPS") return false;
      if (upper === "STD") return false;
      if (upper === "QUAL" || upper === "NONQUAL" || upper === "NON QUAL" || upper === "NQUAL") return false;
      if (upper === "REG" || upper === "UNREG") return false;
      if (upper === "DOM" || upper === "DOMSTC") return false;
      if (upper === "INTL") return false;
      if (upper === "SIG" || upper === "SIGN") return false;
      if (upper === "PREF") return false;
      if (upper === "RWD" || upper === "RWDS") return false;
      if (upper === "MRT") return false;

      // Keep this keyword
      return true;
    });

    // Only update if keywords changed
    if (baseKeywords.length !== originalKeywords.length) {
      await storage.updateDowngradeRule(rule.ruleId, {
        keywords: baseKeywords,
      });

      console.log(`✓ ${rule.name}`);
      console.log(`  Before: [${originalKeywords.join(", ")}]`);
      console.log(`  After:  [${baseKeywords.join(", ")}]`);
      console.log(`  Removed ${originalKeywords.length - baseKeywords.length} variant keywords\n`);

      updatedCount++;
    }
  }

  console.log(`\nComplete! Cleaned up ${updatedCount} rules.`);
}

export { removeKeywordVariants };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  removeKeywordVariants()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}
