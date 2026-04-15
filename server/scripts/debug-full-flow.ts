import { expandAbbreviations } from "./server/engine/abbreviations";

// Simulate the full detection flow
function tokenize(text: string): string[] {
  return text.toUpperCase().split(/[\s/(),+\-]+/).filter(Boolean);
}

function normalizeRoman(text: string): string {
  return text
    .replace(/\bIII\b/g, "3")
    .replace(/\bII\b/g, "2")
    .replace(/\bI\b/g, "1");
}

function keywordsMatch(lineTokens: string[], ruleKeywords: string[]): boolean {
  const lineUpper = normalizeRoman(lineTokens.join(" "));
  const result = ruleKeywords.every((kw) => lineUpper.includes(normalizeRoman(kw.toUpperCase())));
  return result;
}

// Test with actual Superior Fastener patterns
const testCases = [
  {
    line: "VI-US BUS TR1 PRD 1",
    keywords: ["BUS", "T1", "PRODUCT 1"],
    expectedMatch: true,
  },
  {
    line: "VI-US BUS TR3 PRD 1",
    keywords: ["BUS", "T3", "PRODUCT 1"],
    expectedMatch: true,
  },
  {
    line: "VI-US BUS TR4 PRD 1",
    keywords: ["BUS", "T4", "PRODUCT 1"],
    expectedMatch: true,
  },
  {
    line: "VI-US BUS TR5 PRD 1",
    keywords: ["BUS", "T5", "PRODUCT 1"],
    expectedMatch: true,
  },
];

console.log("🔍 Full Detection Flow Debug\n");
console.log("=".repeat(100));
console.log("");

for (const test of testCases) {
  console.log(`Testing: "${test.line}"`);
  console.log(`Keywords: [${test.keywords.join(", ")}]`);
  console.log("");

  // Step 1: Expand abbreviations
  const expanded = expandAbbreviations(test.line);
  console.log("Step 1 - After expandAbbreviations():");
  console.log(`  "${expanded}"`);
  console.log("");

  // Step 2: Tokenize
  const tokens = tokenize(expanded);
  console.log("Step 2 - After tokenize():");
  console.log(`  [${tokens.slice(0, 20).join(", ")}${tokens.length > 20 ? ", ..." : ""}]`);
  console.log(`  Total tokens: ${tokens.length}`);
  console.log("");

  // Step 3: Check if keywords match
  const matches = keywordsMatch(tokens, test.keywords);
  console.log("Step 3 - keywordsMatch():");

  const joinedTokens = normalizeRoman(tokens.join(" "));
  test.keywords.forEach(kw => {
    const normalizedKw = normalizeRoman(kw.toUpperCase());
    const found = joinedTokens.includes(normalizedKw);
    console.log(`  "${kw}" → ${found ? "✅ FOUND" : "❌ NOT FOUND"}`);
  });

  console.log("");
  console.log(`Result: ${matches ? "✅ MATCH" : "❌ NO MATCH"} (expected: ${test.expectedMatch ? "MATCH" : "NO MATCH"})`);
  console.log("");
  console.log("-".repeat(100));
  console.log("");
}
