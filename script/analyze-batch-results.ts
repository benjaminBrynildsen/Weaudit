/**
 * Read script/out/test-batch-results.json and produce a human-readable
 * analysis of patterns the engine isn't catching.
 *
 * Output:
 *   script/out/analysis.md  — narrative report
 *   script/out/missed-by-name.csv — frequency table of every missed
 *     downgrade name, with example raw lines and total dollars missed
 */

import fs from "node:fs";
import path from "node:path";

interface ExpectedRow {
  count: number;
  volume: number;
  name: string;
  rate: number;
  targetRate: number;
  revenueLost: number;
  raw: string;
}

interface FileResult {
  fileName: string;
  status: string;
  errorMessage?: string;
  detectedProcessor?: string;
  expectedVolume?: number;
  detectedVolume?: number;
  expectedRevenueLost?: number;
  detectedRevenueLost?: number;
  expectedRowCount: number;
  detectedFindingCount: number;
  expectedRows: ExpectedRow[];
  detectedFindings: Array<{
    type: string;
    title: string;
    rawLine: string;
    amount: number;
  }>;
  missingRows: ExpectedRow[];
  extraFindings: Array<{ title: string; rawLine: string; amount: number }>;
}

/** Strip volume/rate noise from a downgrade name to get a stable key. */
function nameKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[^A-Z0-9 \-/]/g, "")
    .trim();
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function fmt(n: number | undefined): string {
  if (n === undefined) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function main() {
  const jsonPath = path.resolve("script/out/test-batch-results.json");
  const results: FileResult[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const outDir = path.dirname(jsonPath);

  const totalFiles = results.length;
  const errored = results.filter(
    (r) => r.status === "failed" || r.status === "error",
  );
  const skipped = results.filter((r) => r.status === "skipped_no_data");
  const processed = results.filter(
    (r) => r.status === "complete" || r.status === "needs_review",
  );

  const totalExpected = results.reduce((s, r) => s + r.expectedRowCount, 0);
  const totalDetected = results.reduce((s, r) => s + r.detectedFindingCount, 0);
  const totalMissed = results.reduce((s, r) => s + r.missingRows.length, 0);
  const totalRevenueExpected = results.reduce(
    (s, r) => s + (r.expectedRevenueLost || 0),
    0,
  );
  const totalRevenueDetected = results.reduce(
    (s, r) => s + (r.detectedRevenueLost || 0),
    0,
  );
  const totalRevenueMissed = results.reduce(
    (s, r) => s + r.missingRows.reduce((m, row) => m + row.revenueLost, 0),
    0,
  );

  // Files where detected revenue lost is significantly off from expected
  const revenueMismatches = results
    .filter(
      (r) =>
        r.expectedRevenueLost !== undefined &&
        r.detectedRevenueLost !== undefined &&
        Math.abs((r.expectedRevenueLost || 0) - (r.detectedRevenueLost || 0)) >
          0.5,
    )
    .map((r) => ({
      file: r.fileName,
      expected: r.expectedRevenueLost!,
      detected: r.detectedRevenueLost!,
      delta: (r.detectedRevenueLost || 0) - (r.expectedRevenueLost || 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Group missed rows by downgrade name
  const missedByName = new Map<
    string,
    {
      name: string;
      occurrences: number;
      totalRevenueLost: number;
      examples: Array<{ file: string; raw: string }>;
    }
  >();
  for (const r of results) {
    for (const row of r.missingRows) {
      const key = nameKey(row.name);
      const entry = missedByName.get(key) || {
        name: row.name,
        occurrences: 0,
        totalRevenueLost: 0,
        examples: [],
      };
      entry.occurrences += 1;
      entry.totalRevenueLost += row.revenueLost;
      if (entry.examples.length < 3)
        entry.examples.push({ file: r.fileName, raw: row.raw });
      missedByName.set(key, entry);
    }
  }
  const missedSorted = Array.from(missedByName.values()).sort(
    (a, b) => b.occurrences - a.occurrences || b.totalRevenueLost - a.totalRevenueLost,
  );

  // Files where detected count >> expected count → likely format mis-detection
  const formatLikelyMisdetected = results.filter(
    (r) =>
      r.expectedRowCount > 0 &&
      r.detectedFindingCount > r.expectedRowCount * 3 &&
      r.detectedProcessor !== "WeAudit Report",
  );
  // Files where engine treated an audit-report PDF as a generic statement
  // (no expected rows but detected lots of unknown findings).
  const wrongFormatNoExpected = results.filter(
    (r) =>
      r.expectedRowCount === 0 &&
      r.detectedFindingCount > 10 &&
      r.detectedProcessor !== "WeAudit Report",
  );

  // Write missed-by-name CSV
  const missedCsv = [
    ["downgrade_name", "occurrences", "total_revenue_lost", "example_file", "example_raw"].join(
      ",",
    ),
    ...missedSorted.map((m) =>
      [
        m.name,
        m.occurrences,
        m.totalRevenueLost.toFixed(2),
        m.examples[0]?.file || "",
        m.examples[0]?.raw || "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "missed-by-name.csv"), missedCsv);

  // Markdown report
  const md: string[] = [];
  md.push("# Weaudit batch run analysis");
  md.push("");
  md.push(`Source: \`Test Files 2/ Amanda_s Audits\` (${totalFiles} PDFs)`);
  md.push("");
  md.push("## Top-line numbers");
  md.push("");
  md.push(`- Files: ${totalFiles}`);
  md.push(`- Processed (complete or needs_review): ${processed.length}`);
  md.push(`- Skipped (no data PDFs): ${skipped.length}`);
  md.push(`- Errored: ${errored.length}`);
  md.push(`- Expected downgrade/non-PCI rows across PDFs: ${totalExpected}`);
  md.push(`- Engine findings produced: ${totalDetected}`);
  md.push(`- Expected rows the engine missed: ${totalMissed}`);
  md.push(
    `- Total revenue lost (Amanda): ${fmt(totalRevenueExpected)}; engine reported: ${fmt(totalRevenueDetected)}; missed: ${fmt(totalRevenueMissed)}`,
  );
  md.push("");
  md.push("## Missed downgrade patterns (sorted by frequency)");
  md.push("");
  if (missedSorted.length === 0) {
    md.push("_No missed rows. The engine matched every row Amanda flagged._");
  } else {
    md.push("| Downgrade name | Times missed | Revenue impact | Example raw line |");
    md.push("| --- | ---: | ---: | --- |");
    for (const m of missedSorted.slice(0, 50)) {
      md.push(
        `| ${m.name} | ${m.occurrences} | ${fmt(m.totalRevenueLost)} | \`${m.examples[0]?.raw.slice(0, 90).replace(/\|/g, "\\|") || ""}\` |`,
      );
    }
    if (missedSorted.length > 50)
      md.push(`\n…and ${missedSorted.length - 50} more (see missed-by-name.csv).`);
  }
  md.push("");
  md.push("## Files where the engine misclassified the format");
  md.push("");
  md.push(
    `${wrongFormatNoExpected.length} audit-report PDFs were treated as raw statements (no \`WeAudit Report\` processor detected, but produced 10+ findings).`,
  );
  if (wrongFormatNoExpected.length > 0) {
    md.push("");
    for (const r of wrongFormatNoExpected.slice(0, 20)) {
      md.push(`- \`${r.fileName}\` — detected ${r.detectedFindingCount} findings`);
    }
    if (wrongFormatNoExpected.length > 20)
      md.push(`- …and ${wrongFormatNoExpected.length - 20} more`);
  }
  md.push("");
  md.push("## Revenue-lost mismatches");
  md.push("");
  md.push(
    `${revenueMismatches.length} files where engine total revenue lost differs from Amanda's by more than $0.50.`,
  );
  if (revenueMismatches.length > 0) {
    md.push("");
    md.push("| File | Amanda | Engine | Δ |");
    md.push("| --- | ---: | ---: | ---: |");
    for (const m of revenueMismatches.slice(0, 30)) {
      md.push(
        `| ${m.file} | ${fmt(m.expected)} | ${fmt(m.detected)} | ${m.delta >= 0 ? "+" : ""}${fmt(m.delta)} |`,
      );
    }
    if (revenueMismatches.length > 30)
      md.push(`\n…and ${revenueMismatches.length - 30} more.`);
  }
  md.push("");
  md.push("## Errored files");
  md.push("");
  if (errored.length === 0) {
    md.push("_None._");
  } else {
    for (const r of errored) {
      md.push(`- \`${r.fileName}\` — ${r.errorMessage || r.status}`);
    }
  }
  md.push("");

  fs.writeFileSync(path.join(outDir, "analysis.md"), md.join("\n"));

  console.log(`Wrote ${path.join(outDir, "analysis.md")}`);
  console.log(`Wrote ${path.join(outDir, "missed-by-name.csv")}`);
}

main();
