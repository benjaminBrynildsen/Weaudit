/**
 * Standalone audit validation harness.
 *
 * Runs the engine's detectors against a statement PDF without touching
 * the database or HTTP layer, so we can regression-check the output
 * against the hand-written reference audits in Test Files/.
 *
 * Usage:
 *   npx tsx server/scripts/validate-audit.ts "Test Files/Bank of America - Fiserv/PATRIOT_FLOORING_SUPPLIES - 737191920880_December_LOCATION.pdf" [II|III]
 *   npx tsx server/scripts/validate-audit.ts --all
 */

import fs from "fs";
import path from "path";
import { parsePdf } from "../engine/parser";
import { detectNonPci, detectDowngrades } from "../engine/detectors";
import {
  detectInterchangeSection,
  filterInterchangeLines,
} from "../engine/section-detector";
import { StatementParserFactory } from "../engine/parsers/parser-factory";
import { rules as seedRules } from "../db/seed";
import type { DowngradeRule } from "../storage-types";

function buildRules(): DowngradeRule[] {
  return seedRules.map((r, i) => ({
    ruleId: `seed-${i}`,
    brand: r.brand,
    name: r.name,
    rate: r.rate,
    reason: r.reason,
    targetRate: r.targetRate,
    levelTags: r.levelTags,
    keywords: r.keywords,
    enabled: true,
    informational: r.informational ?? false,
  }));
}

type RunResult = {
  statement: string;
  processor: string;
  gatewayLevel: "II" | "III" | undefined;
  totalVolume: number;
  totalFees: number;
  effectiveRate: number;
  downgrades: Array<{
    title: string;
    trans: number;
    volume: number;
    rate: number;
    targetRate: number;
    revenueLost: number;
  }>;
  nonPciCount: number;
  totalRevenueLost: number;
};

// Parse + normalize a PDF once, then call `runDetection` per gateway
// level. Splitting these halves the wall-clock cost of dual-level runs
// since the PDF parse is the slow part.
async function parseStatement(pdfPath: string) {
  const { pages, fullText } = await parsePdf(pdfPath);

  const genericParser = StatementParserFactory.createParser(undefined);
  const genericFields = genericParser.extractFields(pages);
  const processorName = genericFields.processorDetected || "unknown";

  const parser = StatementParserFactory.createParser(processorName);
  const normalizedLines = parser.normalizePages(pages);
  const fields = parser.extractFields(pages);

  const interchangeSection = detectInterchangeSection(normalizedLines, fullText);
  const interchangeLines = filterInterchangeLines(normalizedLines, interchangeSection);

  return { pages, fullText, processorName, normalizedLines, interchangeLines, fields };
}

type ParsedStatement = Awaited<ReturnType<typeof parseStatement>>;

function runDetection(
  pdfPath: string,
  parsed: ParsedStatement,
  gatewayLevel: "II" | "III" | undefined,
  taxExempt: boolean,
): RunResult {
  const { processorName, normalizedLines, interchangeLines, fields } = parsed;

  const adjustedVolume = (fields.totalVolume || 0) - (fields.amexVolume || 0);
  const adjustedFees = (fields.totalFees || 0) - (fields.amexFees || 0);
  const effectiveRate =
    adjustedVolume > 0 ? adjustedFees / adjustedVolume : fields.effectiveRate || 0;

  const { matchedIndices: nonPciIndices, results: nonPciResults } =
    detectNonPci(normalizedLines);

  let rules = buildRules();
  if (gatewayLevel) {
    rules = rules.filter((r) => r.levelTags.includes(gatewayLevel));
  }

  const { results: downgradesRaw } = detectDowngrades(
    interchangeLines,
    rules,
    nonPciIndices,
    processorName,
  );

  // Mirror runner.ts Step 9.5 — suppress only rules carrying the
  // "(Unless Tax Exempt)" carveout that ALSO target Level III / Data III.
  // Level II targets stay because billing/zip data is still available to
  // tax-exempt merchants.
  const unlessTaxExempt = /\(?\s*unless\s+tax[\s-]*exempt\s*\)?/i;
  const targetsLevelThree = /\b(data|level)\s+III\b/i;
  const downgrades = taxExempt
    ? downgradesRaw.filter(
        (d) => !(unlessTaxExempt.test(d.reason) && targetsLevelThree.test(d.reason)),
      )
    : downgradesRaw;

  // Aggregate downgrades by rule name to match weAudit's report layout.
  const groups = new Map<
    string,
    {
      title: string;
      trans: number;
      volume: number;
      rate: number;
      targetRate: number;
      revenueLost: number;
    }
  >();
  for (const d of downgrades) {
    const g = groups.get(d.title);
    const spread = d.spread ?? 0;
    const trans = d.transactionCount ?? 1;
    if (g) {
      g.trans += trans;
      g.volume += d.amount;
      g.revenueLost += spread;
    } else {
      groups.set(d.title, {
        title: d.title,
        trans,
        volume: d.amount,
        rate: d.rate,
        targetRate: d.targetRate ?? 0,
        revenueLost: spread,
      });
    }
  }

  const downgradeSummary = Array.from(groups.values()).sort(
    (a, b) => b.revenueLost - a.revenueLost,
  );
  const totalRevenueLost = downgradeSummary.reduce(
    (sum, g) => sum + g.revenueLost,
    0,
  );

  return {
    statement: pdfPath,
    processor: processorName,
    gatewayLevel,
    totalVolume: fields.totalVolume || 0,
    totalFees: fields.totalFees || 0,
    effectiveRate,
    downgrades: downgradeSummary,
    nonPciCount: nonPciResults.length,
    totalRevenueLost,
  };
}

async function runOne(
  pdfPath: string,
  gatewayLevel: "II" | "III" | undefined,
  taxExempt: boolean,
): Promise<RunResult> {
  const parsed = await parseStatement(pdfPath);
  return runDetection(pdfPath, parsed, gatewayLevel, taxExempt);
}

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function printResult(r: RunResult) {
  console.log("=".repeat(80));
  console.log(`Statement: ${r.statement}`);
  console.log(
    `Processor detected: ${r.processor}   Gateway level: ${r.gatewayLevel ?? "(none)"}`,
  );
  console.log(
    `Total volume: ${money(r.totalVolume)}   Total fees: ${money(r.totalFees)}   Effective rate: ${(r.effectiveRate * 100).toFixed(3)}%`,
  );
  console.log(`Non-PCI findings: ${r.nonPciCount}`);
  console.log(
    `Total revenue lost (downgrades): ${money(r.totalRevenueLost)}`,
  );
  console.log("");
  if (r.downgrades.length === 0) {
    console.log("  (no downgrades detected)");
  } else {
    console.log(
      "  # Trans | Volume         | Rate  → Target | Revenue Lost | Rule",
    );
    console.log(
      "  --------+----------------+----------------+--------------+--------------------------",
    );
    for (const d of r.downgrades) {
      console.log(
        `  ${String(d.trans).padStart(7)} | ${money(d.volume).padStart(14)} | ${d.rate.toFixed(2)}% → ${d.targetRate.toFixed(2)}% | ${money(d.revenueLost).padStart(12)} | ${d.title}`,
      );
    }
  }
}

function findStatements(root: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root)) {
    const full = path.join(root, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...findStatements(full));
    else if (/\.pdf$/i.test(entry) && !/audit/i.test(entry)) out.push(full);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const levelArg = argv.find((a) => a === "II" || a === "III") as
    | "II"
    | "III"
    | undefined;
  const taxExempt = argv.includes("--tax-exempt") || argv.includes("--taxExempt");
  const fileArgs = argv.filter(
    (a) =>
      a !== "II" &&
      a !== "III" &&
      a !== "--all" &&
      a !== "--tax-exempt" &&
      a !== "--taxExempt",
  );

  const targets: string[] = argv.includes("--all")
    ? findStatements("Test Files")
    : fileArgs;

  if (targets.length === 0) {
    console.error("No statement PDFs specified. Use --all or pass paths.");
    process.exit(1);
  }

  // When no level is specified the harness has no per-merchant gateway
  // signal (the real upload UI sets this; Amanda's reference PDFs encode
  // it in the title with -L2/-L3). Run both views side-by-side so the
  // batch comparison can pick whichever level matches the reference.
  const levels: (("II" | "III") | undefined)[] = levelArg ? [levelArg] : ["II", "III"];

  for (const t of targets) {
    let parsed: ParsedStatement;
    try {
      parsed = await parseStatement(t);
    } catch (err) {
      console.error(`\n!! Failed to parse ${t}:`, (err as Error).message);
      continue;
    }
    for (const lvl of levels) {
      try {
        const result = runDetection(t, parsed, lvl, taxExempt);
        printResult(result);
      } catch (err) {
        console.error(`\n!! Failed on ${t} (level ${lvl ?? "all"}):`, (err as Error).message);
      }
    }
  }
}

main();
