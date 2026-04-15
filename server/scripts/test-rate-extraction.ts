// Test rate extraction from the MC-BUS LEVEL 5 line
const BARE_RATE_RE_OLD = /\b(0\.\d{3,4})\b/g;
const BARE_RATE_RE = /(?<!\$)(0\.\d{3,4})\b/g;
const RATE_RE = /(\d+\.?\d*)\s*%/g;

const testLine = "MC-BUS LEVEL 5 DATA RATE I $6,254.05 26% 1 3% 0.0300 $0.100 -$187.72";

console.log("Testing line:", testLine);
console.log("\nSearching for % rates:");
const rates = testLine.match(RATE_RE);
console.log("  Found:", rates);
if (rates) {
  console.log("  Last rate:", rates[rates.length - 1]);
  console.log("  Parsed:", rates[rates.length - 1].replace("%", "").trim());
}

console.log("\nSearching for bare decimal rates:");
const bareRates = testLine.match(BARE_RATE_RE);
console.log("  Found:", bareRates);
if (bareRates) {
  console.log("  Last bare rate:", bareRates[bareRates.length - 1]);
  console.log("  Parsed (× 100):", parseFloat(bareRates[bareRates.length - 1]) * 100);
}

console.log("\nChecking if it's a grid line (3+ amounts):");
const AMOUNT_RE = /\$[\d,]+\.?\d*/g;
const amounts = testLine.match(AMOUNT_RE);
console.log("  Amounts found:", amounts);
console.log("  Is grid line:", amounts && amounts.length >= 3);
