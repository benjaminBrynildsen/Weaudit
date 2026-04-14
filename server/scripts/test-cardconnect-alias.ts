// Test if CardConnect aliases are matching
const CARDCONNECT_ALIASES: [RegExp, string][] = [
  [/VI[-\s]US\s+BUS\s+TR(\d+)\s+PRD\s+(\d+)/i, "VISA BUS T$1 PRODUCT $2"],
  [/VI[-\s]BUSINESS\s+TR(\d+)\s+PRODUCT\s+(\d+)/i, "VISA BUS T$1 PRODUCT $2"],
];

const testLine = "VI-US BUS TR1 PRD 1 $12.65 0% 1 1% 0.0265 $0.100 -$0.44";

console.log("Testing CardConnect alias matching\n");
console.log("Original line:");
console.log(`  "${testLine}"`);
console.log("");

for (const [pattern, standard] of CARDCONNECT_ALIASES) {
  const matches = pattern.test(testLine);
  console.log(`Pattern: ${pattern}`);
  console.log(`  Matches: ${matches}`);

  if (matches) {
    const replaced = testLine.replace(pattern, standard);
    console.log(`  Result: "${replaced}"`);
  }
  console.log("");
}
