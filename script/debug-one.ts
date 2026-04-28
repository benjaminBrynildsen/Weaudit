import { parsePdf } from "../server/engine/parser";
import { StatementParserFactory } from "../server/engine/parsers/parser-factory";
import { detectNonPci } from "../server/engine/detectors";
import { detectInterchangeSection, filterInterchangeLines } from "../server/engine/section-detector";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("usage: tsx debug-one.ts <pdf>");
  const { pages, fullText } = await parsePdf(filePath);
  console.log("=== RAW PAGE TEXT ===");
  for (const p of pages) {
    console.log(`--- page ${p.pageNum} ---`);
    console.log(p.text);
  }
  console.log("=== END ===\n");
  const parser = StatementParserFactory.detectAuditReport(pages);
  if (!parser) {
    console.log("Not detected as audit report");
    return;
  }
  const lines = parser.normalizePages(pages);
  console.log(`Normalized lines: ${lines.length}`);
  for (const l of lines) {
    console.log(`  amt=${l.amount} amtIsVol=${l.amountIsVolume} raw=${JSON.stringify(l.raw.slice(0, 90))}`);
  }
  const nonPci = detectNonPci(lines);
  console.log(`\ndetectNonPci hit ${nonPci.results.length} lines`);
  for (const r of nonPci.results) console.log(`  ${r.title} amt=${r.amount} raw=${JSON.stringify(r.rawLine.slice(0, 80))}`);

  const section = detectInterchangeSection(lines, fullText);
  const ic = filterInterchangeLines(lines, section);
  console.log(`\nInterchange filter kept ${ic.length}/${lines.length} lines`);
  console.log(`In nonPci's matchedIndices: ${[...nonPci.matchedIndices]}`);
}

main();
