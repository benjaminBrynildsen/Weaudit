import { parsePdf } from "./server/engine/parser";
import { normalizePages } from "./server/engine/normalizer";
import path from "path";

async function debug() {
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");
  const result = await parsePdf(pdfPath);
  const lines = normalizePages(result.pages);

  // Find lines with "BUSINESS CARD" or "PURCHASING"
  const testLines = lines.filter(l =>
    /BUSINESS\s+CARD|PURCHASING|NON\s+QUAL/i.test(l.raw)
  ).slice(0, 10);

  console.log("Sample normalized lines that should match downgrade rules:\n");
  testLines.forEach((line, i) => {
    console.log(`${i + 1}. Raw: ${line.raw}`);
    console.log(`   Amount: $${line.amount.toFixed(2)}, Rate: ${line.rate.toFixed(2)}%, IsVolume: ${line.amountIsVolume}`);
    console.log(`   Page ${line.page}, Line ${line.lineNum}\n`);
  });

  // Test keyword matching logic
  console.log("\n--- Testing keyword tokenization ---");
  const testLine = "IC VI-BUSINESS CARD TR3 LEVEL 2";
  const tokens = testLine.toUpperCase().split(/[\s/(),+\-]+/).filter(Boolean);
  console.log("Test line:", testLine);
  console.log("Tokens:", tokens);
  console.log("Joined:", tokens.join(" "));

  // Test with alias expansion
  console.log("\n--- Testing alias expansion ---");
  const processorName = "CardConnect";
  // Simulate expandProcessorAliases
  let expanded = testLine;
  const pattern = /VI[-\s]BUSINESS\s+CARD\s+TR(\d+)\s+LEVEL\s+(\d+)/i;
  if (pattern.test(testLine)) {
    const match = testLine.match(pattern);
    expanded += " VISA BUS T" + match![1] + " LEVEL " + match![2];
  }
  console.log("Original:", testLine);
  console.log("Expanded:", expanded);
  console.log("Expanded tokens:", expanded.toUpperCase().split(/[\s/(),+\-]+/).filter(Boolean).join(" "));

  // Check if expected keywords would match
  const ruleKeywords = ["BUS", "LEVEL 2"];
  console.log("\nRule keywords:", ruleKeywords);
  console.log("Would match?", ruleKeywords.every((kw) => expanded.toUpperCase().includes(kw.toUpperCase())));
}

debug().catch(console.error);
