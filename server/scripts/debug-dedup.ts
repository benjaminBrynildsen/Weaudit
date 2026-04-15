import { parsePdf } from "./server/engine/parser";
import { normalizePages } from "./server/engine/normalizer";
import { detectDowngrades } from "./server/engine/detectors";
import { storage } from "./server/storage";
import path from "path";

async function debugDedup() {
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");

  const result = await parsePdf(pdfPath);
  const lines = normalizePages(result.pages);

  // Get downgrade rules
  const rules = await storage.listDowngradeRules();
  const l2Rules = rules.filter(r => r.levelTags.includes("II"));

  const { results } = detectDowngrades(lines, l2Rules, new Set(), "CardConnect");

  console.log(`Total downgrade detections BEFORE dedup: ${results.length}\n`);

  // Group by title
  const byTitle = new Map<string, typeof results>();
  results.forEach(r => {
    if (!byTitle.has(r.title)) {
      byTitle.set(r.title, []);
    }
    byTitle.get(r.title)!.push(r);
  });

  console.log("Breakdown by title:");
  for (const [title, matches] of byTitle.entries()) {
    console.log(`\n"${title}" - ${matches.length} occurrences:`);
    matches.forEach((m, i) => {
      console.log(`  ${i + 1}. Page ${m.page}, Line ${m.lineNum}: $${m.amount.toFixed(2)} (${m.rate.toFixed(2)}%)`);
      console.log(`      Raw: ${m.rawLine.slice(0, 100)}`);
    });
  }

  // Simulate deduplication
  console.log("\n\n=== After Deduplication (keep highest amount) ===\n");
  const dedupMap = new Map<string, typeof results[0]>();
  for (const d of results) {
    const existing = dedupMap.get(d.title);
    if (!existing || d.amount > existing.amount) {
      dedupMap.set(d.title, d);
    }
  }

  console.log(`Total AFTER dedup: ${dedupMap.size}\n`);
  for (const [title, match] of dedupMap.entries()) {
    console.log(`"${title}": $${match.amount.toFixed(2)} on Page ${match.page}, Line ${match.lineNum}`);
  }
}

debugDedup().catch(console.error);
