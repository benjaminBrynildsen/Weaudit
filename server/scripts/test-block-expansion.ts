/**
 * Test script for block-based abbreviation expansion
 * Usage: npx tsx test-block-expansion.ts
 */

import { explainExpansion, generateLineVariants, tokenizeLine, expandBlock } from "./server/engine/block-expander";

console.log("=".repeat(80));
console.log("BLOCK-BASED ABBREVIATION EXPANSION TEST");
console.log("=".repeat(80));

// Test cases from real statements
const testLines = [
  "VI-US BUS TR1 PRD 1",
  "MC-BUS LEVEL 2 DATA RATE 1",
  "MC-CORP DATA RATE II (US) CORP",
  "MC-CORP DATA RATE I (US) CORP",
  "VI-PURCHASING LEVEL II",
  "MC-BUS CARD STD",
  "VI-NON QUAL BUS CR",
  "MC-CORP DATA RT 2 PURCH",
  "VI-CPS CNP",
  "MC-FLEET STD",
];

testLines.forEach((line, idx) => {
  console.log(`\n${idx + 1}. Testing: "${line}"`);
  console.log("-".repeat(80));

  const explanation = explainExpansion(line);

  console.log(`📦 Blocks (${explanation.blocks.length}):`);
  explanation.blocks.forEach((block, i) => {
    const variants = explanation.expandedBlocks[i];
    if (variants.length > 1) {
      console.log(`   [${i}] "${block}" → [${variants.join(", ")}]`);
    } else {
      console.log(`   [${i}] "${block}" (no expansion)`);
    }
  });

  console.log(`\n🔄 Generated Variants (${explanation.variantCount}):`);
  if (explanation.variantCount <= 10) {
    explanation.variants.forEach((variant, i) => {
      console.log(`   ${i + 1}. ${variant}`);
    });
  } else {
    explanation.variants.slice(0, 5).forEach((variant, i) => {
      console.log(`   ${i + 1}. ${variant}`);
    });
    console.log(`   ... (${explanation.variantCount - 10} more variants)`);
    explanation.variants.slice(-5).forEach((variant, i) => {
      console.log(`   ${explanation.variantCount - 4 + i}. ${variant}`);
    });
  }
});

console.log("\n" + "=".repeat(80));
console.log("✅ BLOCK EXPANSION SYSTEM READY");
console.log("=".repeat(80));

// Test keyword matching scenario
console.log("\n📊 MATCHING SCENARIO TEST\n");
console.log("Rule keywords: [\"BUS\", \"T1\", \"PRODUCT 1\"]");
console.log("Line: \"VI-US BUS TR1 PRD 1\"\n");

const variants = generateLineVariants("VI-US BUS TR1 PRD 1");
console.log(`Generated ${variants.length} variants:`);
variants.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));

console.log("\nChecking which variants contain ALL keywords:");
const keywords = ["BUS", "T1", "PRODUCT 1"];
const matchingVariants = variants.filter(v =>
  keywords.every(kw => v.toUpperCase().includes(kw.toUpperCase()))
);

console.log(`\n✅ ${matchingVariants.length} variant(s) match:`);
matchingVariants.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));

console.log("\n" + "=".repeat(80));
