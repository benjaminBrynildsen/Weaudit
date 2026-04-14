// Test if MC-CORP DATA RATE line should match the rule

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
  console.log(`  Joined & normalized line: "${lineUpper}"`);

  const allMatch = ruleKeywords.every((kw) => {
    const normalized = normalizeRoman(kw.toUpperCase());
    const matches = lineUpper.includes(normalized);
    console.log(`    Keyword "${kw}" → "${normalized}": ${matches ? "✓" : "✗"}`);
    return matches;
  });

  return allMatch;
}

// Test line from the statement
const line = "MC-CORP DATA RATE I (US) BUS $186.82 0% 2 2% 0.0265 $0.100 -$5.15";

// CORP DATA RATE I (US) BUS rule keywords
const corpDataRateKeywords = ["DATA RATE 1", "CORP", "BUS", "DATA RT 1", "DT RT 1", "DT RATE 1"];

// Non-Qual Purch Data keywords (the problem!)
const nonQualKeywords = ["DATA"];

console.log("Testing MC-CORP DATA RATE I (US) BUS line\n");
console.log(`Original line: "${line}"\n`);

const tokens = tokenize(line);
console.log(`Tokens: [${tokens.slice(0, 15).join(", ")}...]\n`);

console.log("Test 1: Should match CORP DATA RATE I (US) BUS rule");
const match1 = keywordsMatch(tokens, corpDataRateKeywords);
console.log(`  Result: ${match1 ? "✅ MATCH" : "❌ NO MATCH"}\n`);

console.log("Test 2: Should NOT match Non-Qual Purch Data rule (Visa only!)");
const match2 = keywordsMatch(tokens, nonQualKeywords);
console.log(`  Result: ${match2 ? "❌ WRONG MATCH!" : "✅ CORRECTLY NO MATCH"}\n`);
