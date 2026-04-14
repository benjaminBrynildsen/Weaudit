import { parsePdf } from "./server/engine/parser";
import { normalizePages } from "./server/engine/normalizer";
import { detectInterchangeSection, filterInterchangeLines, debugSection } from "./server/engine/section-detector";
import path from "path";

async function debugSectionDetection() {
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");
  const result = await parsePdf(pdfPath);
  const lines = normalizePages(result.pages);

  console.log(`Total normalized lines: ${lines.length}\n`);

  const section = detectInterchangeSection(lines, result.fullText);

  if (!section) {
    console.log("❌ No section detected");
    return;
  }

  console.log(`✅ Section detected: "${section.sectionName}"`);
  console.log(`   Lines ${section.startLine} - ${section.endLine}\n`);

  debugSection(section, result.fullText);

  const filteredLines = filterInterchangeLines(lines, section);
  console.log(`\nFiltered to ${filteredLines.length} lines\n`);

  if (filteredLines.length > 0) {
    console.log("Sample filtered lines:");
    filteredLines.slice(0, 5).forEach(l => {
      console.log(`  Page ${l.page}, Line ${l.lineNum}: $${l.amount.toFixed(2)}`);
      console.log(`    ${l.raw.slice(0, 100)}`);
    });
  } else {
    console.log("Problem: No lines match the section boundaries!");
    console.log("\nNormalized line numbers (first 10):");
    lines.slice(0, 10).forEach(l => {
      console.log(`  Line ${l.lineNum}, Page ${l.page}: ${l.raw.slice(0, 60)}`);
    });
  }
}

debugSectionDetection().catch(console.error);
