import { parsePdf } from "./server/engine/parser";
import { normalizePages } from "./server/engine/normalizer";
import path from "path";

async function debugGridLine() {
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");
  const result = await parsePdf(pdfPath);
  const pages = result.pages;

  // Find the grid line for VI-PURCHASING
  const page6Text = pages.find(p => p.pageNum === 6)?.text || "";
  const gridLine = page6Text.split("\n").find(l => /VI-PURCHASING CREDIT PRODUCT 1.*173\.23/i.test(l));

  console.log("Raw grid line from PDF:");
  console.log(gridLine);
  console.log();

  // Normalize it
  const normalized = normalizePages(pages);
  const purchasingLines = normalized.filter(l =>
    l.page === 6 && /PURCHASING.*PRODUCT.*1/i.test(l.raw)
  );

  console.log(`Normalized lines for VI-PURCHASING on Page 6: ${purchasingLines.length}\n`);
  purchasingLines.forEach((l, i) => {
    console.log(`${i + 1}. Line ${l.lineNum}: Amount=$${l.amount.toFixed(2)}, Rate=${l.rate.toFixed(2)}%, IsVolume=${l.amountIsVolume}`);
    console.log(`   Raw: ${l.raw}`);
    console.log();
  });
}

debugGridLine().catch(console.error);
