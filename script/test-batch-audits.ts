/**
 * Batch-test the audit engine against Amanda's manually-completed audit
 * PDFs in Test Files 2.
 *
 * For each PDF:
 *   1. Parse the PDF text directly to extract Amanda's expected downgrade
 *      rows (the "answer key" — every row in her downgrade table).
 *   2. Run the engine end-to-end (createAudit → createStatement →
 *      runAuditScan → getFindingsByAudit) against the same PDF.
 *   3. Diff: which expected downgrade rows did the engine fail to detect?
 *
 * Output: writes a JSON + CSV report to script/out/test-batch-results.*
 * with one row per audit PDF including expected count, detected count,
 * and the raw text of any rows the engine missed (so rule gaps are
 * obvious).
 *
 * Run:
 *   DATABASE_URL=... tsx script/test-batch-audits.ts \
 *     "/home/wolfgang/Weaudit/Test Files/TEST FILES 2/ Amanda_s Audits"
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { storage } from "../server/storage";
import { runAuditScan } from "../server/engine/runner";

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
  auditId: string;
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

function pdfToText(filePath: string): string {
  try {
    return execFileSync("pdftotext", ["-layout", filePath, "-"], {
      encoding: "utf-8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (e) {
    console.error(`pdftotext failed for ${filePath}: ${(e as Error).message}`);
    return "";
  }
}

/**
 * Pull the rows Amanda put in the downgrade table out of an audit PDF.
 * Matches: "1 \t$6,254.05 \tM-BUS LEVEL 5 DATA RATE 1 \t3.00% \t2.25% \t$46.91"
 * Also matches NON PCI FEE rows.
 */
function extractExpectedRows(fullText: string): ExpectedRow[] {
  const rows: ExpectedRow[] = [];
  const lines = fullText.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 5) continue;

    // Skip "No Data Available" rows - these are placeholders, not real findings
    if (/no\s+data\s+available/i.test(line)) continue;
    if (/#N\/A/i.test(line)) continue;

    // Standard downgrade row: count $vol name rate% target% $loss
    const m = line.match(
      /^(\d+)\s+\$([\d,]+\.?\d*)\s+(.+?)\s+(\d+\.?\d*)\s*%\s+(\d+\.?\d*)\s*%\s+\$([\d,]+\.?\d*)/,
    );
    if (m) {
      rows.push({
        count: parseInt(m[1], 10),
        volume: parseFloat(m[2].replace(/,/g, "")),
        name: m[3].trim(),
        rate: parseFloat(m[4]),
        targetRate: parseFloat(m[5]),
        revenueLost: parseFloat(m[6].replace(/,/g, "")),
        raw: line,
      });
      continue;
    }

    // NON PCI FEE row: "1 $149.99 NON PCI FEE $0.00"
    const npc = line.match(
      /^(\d+)\s+\$([\d,]+\.?\d*)\s+(NON\s*PCI\s*FEE)/i,
    );
    if (npc) {
      rows.push({
        count: parseInt(npc[1], 10),
        volume: parseFloat(npc[2].replace(/,/g, "")),
        name: "NON PCI FEE",
        rate: 0,
        targetRate: 0,
        revenueLost: 0,
        raw: line,
      });
    }
  }
  return rows;
}

function extractProcessingVolumeFromText(fullText: string): number | undefined {
  // Pull the largest standalone $ amount (matches AuditReportParser logic)
  const candidates: number[] = [];
  for (const raw of fullText.split("\n")) {
    const line = raw.trim();
    const dm = line.match(/^\$([\d,]+\.?\d*)$/);
    if (dm) candidates.push(parseFloat(dm[1].replace(/,/g, "")));
  }
  const filtered = candidates.filter((v) => v > 1000);
  return filtered.length > 0 ? Math.max(...filtered) : undefined;
}

function extractRevenueLostFromText(fullText: string): number | undefined {
  const m = fullText.match(/Total\s*Revenue\s*Lost\s+\$([\d,]+\.?\d*)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : undefined;
}

/**
 * Match an expected row against the engine's findings. Both come from the
 * same PDF text, so the underlying dollar amount (volume) is identical to
 * the cent — that is the strongest signal. Only fall back to name overlap
 * when the amount happens to be zero (e.g. NON PCI FEE with $0 revenue
 * lost where the engine stores $0 too).
 */
function findingMatchesRow(
  finding: { title: string; rawLine: string; amount: number },
  row: ExpectedRow,
): boolean {
  // 1) Amount match — strongest signal. The audit-report parser stores
  // the volume number in `amount`, which equals row.volume to the cent.
  if (row.volume > 0 && Math.abs(finding.amount - row.volume) < 0.01) {
    return true;
  }

  // 2) For zero-amount rows, fall back to name match with tier/product
  // disambiguation (T1 != T5, Product 1 != Product 2).
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const titleN = norm(finding.title);
  const rowN = norm(row.name);
  const rawN = norm(finding.rawLine);

  // Extract tier/product numbers — require exact match if present in row
  const tierNum = (s: string) => {
    const m = s.match(/\bt(\d)\b/);
    return m ? m[1] : null;
  };
  const productNum = (s: string) => {
    const m = s.match(/\bproduct\s+(\d)\b/);
    return m ? m[1] : null;
  };
  const rowTier = tierNum(rowN);
  const rowProd = productNum(rowN);
  const findingHaystack = `${titleN} ${rawN}`;
  if (rowTier && tierNum(findingHaystack) !== rowTier) return false;
  if (rowProd && productNum(findingHaystack) !== rowProd) return false;

  // Substring match
  if (rawN.length > 0 && rowN.length > 0 && rawN.includes(rowN)) return true;

  // Token overlap on >=4-char words AFTER tier/product check
  const titleTokens = new Set(titleN.split(" ").filter((t) => t.length >= 4));
  const rowTokens = rowN.split(" ").filter((t) => t.length >= 4);
  let overlap = 0;
  for (const t of rowTokens) if (titleTokens.has(t)) overlap += 1;
  return overlap >= Math.min(2, rowTokens.length) && rowTokens.length > 0;
}

async function processOne(filePath: string): Promise<FileResult> {
  const fileName = path.basename(filePath);
  const fullText = pdfToText(filePath);
  const expectedRows = extractExpectedRows(fullText);
  const expectedVolume = extractProcessingVolumeFromText(fullText);
  const expectedRevenueLost = extractRevenueLostFromText(fullText);

  // Skip files with no usable data
  if (expectedRows.length === 0 && /no\s+data\s+available/i.test(fullText)) {
    return {
      fileName,
      auditId: "",
      status: "skipped_no_data",
      expectedRowCount: 0,
      detectedFindingCount: 0,
      expectedRows: [],
      detectedFindings: [],
      missingRows: [],
      extraFindings: [],
      expectedVolume,
      expectedRevenueLost,
    };
  }

  const audit = await storage.createAudit({
    clientName: fileName,
    processor: "Unknown",
    statementMonth: "",
    mid: "",
    status: "idle",
  });

  await storage.createStatement({
    auditId: audit.auditId,
    fileName,
    filePath,
    fileType: "pdf",
  });

  let runErr: string | undefined;
  try {
    await runAuditScan(audit.auditId);
  } catch (e) {
    runErr = (e as Error).message;
  }

  const finalAudit = await storage.getAudit(audit.auditId);
  const findings = await storage.getFindingsByAudit(audit.auditId);

  const detectedFindings = findings.map((f) => ({
    type: f.type,
    title: f.title,
    rawLine: f.rawLine,
    amount: f.amount,
  }));

  const missingRows: ExpectedRow[] = [];
  const matchedFindingIdx = new Set<number>();
  for (const row of expectedRows) {
    let matched = false;
    for (let i = 0; i < detectedFindings.length; i++) {
      if (matchedFindingIdx.has(i)) continue;
      if (findingMatchesRow(detectedFindings[i], row)) {
        matched = true;
        matchedFindingIdx.add(i);
        break;
      }
    }
    if (!matched) missingRows.push(row);
  }
  const extraFindings = detectedFindings
    .filter((_, i) => !matchedFindingIdx.has(i))
    .map((f) => ({ title: f.title, rawLine: f.rawLine, amount: f.amount }));

  return {
    fileName,
    auditId: audit.auditId,
    status: finalAudit?.status || "unknown",
    errorMessage: runErr || finalAudit?.errorMessage,
    detectedProcessor: finalAudit?.processorDetected,
    expectedVolume,
    detectedVolume: finalAudit?.totalVolume,
    expectedRevenueLost,
    detectedRevenueLost: finalAudit?.totalFees,
    expectedRowCount: expectedRows.length,
    detectedFindingCount: detectedFindings.length,
    expectedRows,
    detectedFindings,
    missingRows,
    extraFindings,
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const inputDir = process.argv[2];
  if (!inputDir) throw new Error("usage: tsx test-batch-audits.ts <dir>");
  const limitArg = process.argv[3];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  const targets = limit ? files.slice(0, limit) : files;
  console.log(`[batch] processing ${targets.length} of ${files.length} PDFs`);

  const outDir = path.resolve("script/out");
  fs.mkdirSync(outDir, { recursive: true });

  const results: FileResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const file = targets[i];
    const filePath = path.join(inputDir, file);
    process.stdout.write(`[${i + 1}/${targets.length}] ${file} ... `);
    try {
      const r = await processOne(filePath);
      results.push(r);
      const miss = r.missingRows.length;
      console.log(
        `${r.status} (${r.expectedRowCount} expected, ${r.detectedFindingCount} detected, ${miss} missed)`,
      );
    } catch (e) {
      console.log(`ERROR ${(e as Error).message}`);
      results.push({
        fileName: file,
        auditId: "",
        status: "error",
        errorMessage: (e as Error).message,
        expectedRowCount: 0,
        detectedFindingCount: 0,
        expectedRows: [],
        detectedFindings: [],
        missingRows: [],
        extraFindings: [],
      });
    }
  }

  // Summary stats
  const totalExpected = results.reduce((s, r) => s + r.expectedRowCount, 0);
  const totalDetected = results.reduce((s, r) => s + r.detectedFindingCount, 0);
  const totalMissed = results.reduce((s, r) => s + r.missingRows.length, 0);
  const filesWithMisses = results.filter((r) => r.missingRows.length > 0);
  const filesWithErrors = results.filter(
    (r) => r.status === "failed" || r.status === "error",
  );

  console.log("\n=== Summary ===");
  console.log(`Files processed:  ${results.length}`);
  console.log(`Files with errors: ${filesWithErrors.length}`);
  console.log(`Files with misses: ${filesWithMisses.length}`);
  console.log(`Total expected rows: ${totalExpected}`);
  console.log(`Total detected findings: ${totalDetected}`);
  console.log(`Total missed rows: ${totalMissed}`);

  // JSON dump (full detail)
  fs.writeFileSync(
    path.join(outDir, "test-batch-results.json"),
    JSON.stringify(results, null, 2),
  );

  // CSV (per-file summary)
  const csvLines = [
    [
      "file",
      "status",
      "processor",
      "expected_rows",
      "detected_findings",
      "missed_rows",
      "expected_volume",
      "detected_volume",
      "expected_revenue_lost",
      "detected_revenue_lost",
      "error",
    ].join(","),
    ...results.map((r) =>
      [
        r.fileName,
        r.status,
        r.detectedProcessor || "",
        r.expectedRowCount,
        r.detectedFindingCount,
        r.missingRows.length,
        r.expectedVolume ?? "",
        r.detectedVolume ?? "",
        r.expectedRevenueLost ?? "",
        r.detectedRevenueLost ?? "",
        r.errorMessage || "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  fs.writeFileSync(
    path.join(outDir, "test-batch-summary.csv"),
    csvLines.join("\n"),
  );

  // Missed-rows CSV: every row Amanda had that the engine didn't catch
  const missedLines = [
    ["file", "downgrade_name", "count", "volume", "rate", "target_rate", "revenue_lost", "raw"].join(","),
    ...results.flatMap((r) =>
      r.missingRows.map((m) =>
        [
          r.fileName,
          m.name,
          m.count,
          m.volume,
          m.rate,
          m.targetRate,
          m.revenueLost,
          m.raw,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ),
  ];
  fs.writeFileSync(
    path.join(outDir, "test-batch-missed-rows.csv"),
    missedLines.join("\n"),
  );

  console.log(`\nWrote: ${outDir}/test-batch-results.json`);
  console.log(`Wrote: ${outDir}/test-batch-summary.csv`);
  console.log(`Wrote: ${outDir}/test-batch-missed-rows.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
