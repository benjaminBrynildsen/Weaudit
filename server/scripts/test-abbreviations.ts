import { expandAbbreviations } from "./server/engine/abbreviations";

const testCases = [
  "VI-US BUS TR1 PRD 1",
  "MC-BUS LEVEL 5 DATA RATE I",
  "VI-CORP CREDIT PRODUCT 1",
  "MC-COMM DATA RT II FLT NONFL",
  "VI-US BUS TR3 PRD 1",
  "MC-BUS LVL 2 DT RT 1",
  "VI-PURCHASING CARD LEVEL 3",
  "MC-CORP DATA RATE I (US) BUS",
];

console.log("Testing Abbreviation Expansion\n");
console.log("=".repeat(80));
console.log("");

testCases.forEach(line => {
  console.log("Original:");
  console.log(`  ${line}`);
  console.log("");
  console.log("Expanded:");
  const expanded = expandAbbreviations(line);
  console.log(`  ${expanded}`);
  console.log("");
  console.log("-".repeat(80));
  console.log("");
});
