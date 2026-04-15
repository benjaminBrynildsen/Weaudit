import { expandAbbreviations } from "./server/engine/abbreviations";

// Test with actual Superior Fastener line patterns
const testLines = [
  "VI-US BUS TR1 PRD 1",
  "VI-US BUS TR3 PRD 1",
  "VI-US BUS TR4 PRD 1",
  "VI-US BUS TR5 PRD 1",
  "MC-CORP DATA RATE I (US) BUS",
  "VISA BUS T1 PRODUCT 1", // Already in correct format
];

console.log("🔍 Debugging Abbreviation Expansion\n");
console.log("=".repeat(80));
console.log("");

testLines.forEach(line => {
  console.log("Original line:");
  console.log(`  "${line}"`);
  console.log("");

  const expanded = expandAbbreviations(line);
  console.log("Expanded line:");
  console.log(`  "${expanded}"`);
  console.log("");

  // Test if it would match common keywords
  const upperExpanded = expanded.toUpperCase();

  console.log("Would match:");
  console.log(`  "BUS": ${upperExpanded.includes("BUS")}`);
  console.log(`  "T1": ${upperExpanded.includes("T1")}`);
  console.log(`  "TR1": ${upperExpanded.includes("TR1")}`);
  console.log(`  "PRODUCT 1": ${upperExpanded.includes("PRODUCT 1")}`);
  console.log(`  "PRD 1": ${upperExpanded.includes("PRD 1")}`);
  console.log("");
  console.log("-".repeat(80));
  console.log("");
});
