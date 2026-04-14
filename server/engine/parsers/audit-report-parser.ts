import { BaseStatementParser, ExtractedFields, NormalizedLine } from './base-parser';
import type { ParsedPage } from '../parser';

/**
 * Parser for internally-generated audit report PDFs (spreadsheet/Excel exports).
 * These have a distinct format with:
 *   - Company name + MID in header (e.g., "Patriot Flooring Supplies - L2 -0880")
 *   - "Processing Volume" with a dollar amount
 *   - "Based on: December 2025" for statement month
 *   - "Total Revenue Lost $X"
 *   - Downgrade table rows: count, $volume, downgrade_name, rate%, target%, $revenue_lost
 */
export class AuditReportParser extends BaseStatementParser {

  /**
   * Detect whether the given text looks like an audit report PDF
   * (as opposed to a processor statement PDF).
   */
  static isAuditReport(fullText: string): boolean {
    // These audit reports have very distinctive markers
    const hasProcessingVolume = /Processing\s*Volume/i.test(fullText);
    const hasRevenueLost = /(?:Total\s*)?Revenue\s*Lost/i.test(fullText);
    const hasBasedOn = /Based\s*on:\s/i.test(fullText);
    const hasDowngradeTable = /# of Trans\s+Volume/i.test(fullText);
    // Must match at least 3 of 4 markers
    const score = [hasProcessingVolume, hasRevenueLost, hasBasedOn, hasDowngradeTable]
      .filter(Boolean).length;
    return score >= 3;
  }

  normalizePages(pages: ParsedPage[]): NormalizedLine[] {
    const lines: NormalizedLine[] = [];

    for (const page of pages) {
      const textLines = page.text.split("\n");
      for (let i = 0; i < textLines.length; i++) {
        const raw = textLines[i].trim();
        if (!raw || raw.length < 5) continue;

        // Match downgrade rows: count \t $volume \t name \t rate% \t target% \t $revenue_lost
        // Example: "1 	$6,254.05 	M-BUS LEVEL 5 DATA RATE 1 	3.00% 	2.25% 	$46.91"
        const dgMatch = raw.match(
          /^(\d+)\s+\$([\d,]+\.?\d*)\s+(.+?)\s+(\d+\.?\d*)\s*%\s+(\d+\.?\d*)\s*%\s+\$([\d,]+\.?\d*)/
        );
        if (dgMatch) {
          const volume = this.parseAmount("$" + dgMatch[2]);
          const rate = parseFloat(dgMatch[4]);
          lines.push({
            raw,
            amount: volume,
            rate,
            page: page.pageNum,
            lineNum: i + 1,
            amountIsVolume: true,
          });
          continue;
        }

        // Also capture NON PCI FEE lines: "1 	$149.99 	NON PCI FEE 	$0.00"
        const npcMatch = raw.match(/^(\d+)\s+\$([\d,]+\.?\d*)\s+(NON\s*PCI\s*FEE)/i);
        if (npcMatch) {
          const amount = this.parseAmount("$" + npcMatch[2]);
          lines.push({
            raw,
            amount,
            rate: 0,
            page: page.pageNum,
            lineNum: i + 1,
            amountIsVolume: false,
          });
        }
      }
    }

    return lines;
  }

  extractFields(pages: ParsedPage[]): ExtractedFields {
    const fullText = pages.map((p) => p.text).join("\n");
    const fields: ExtractedFields = {};

    // Extract company name + MID from header line
    // Formats:
    //   "Patriot Flooring Supplies - L2 -0880"
    //   "Superior Industrial - 3881 - L3"
    //   "Plywood Supply 1882 - L2"
    //   "Plywood Supply 5881- L2"
    //   "Shore Distributors L3"
    const companyLine = this.extractCompanyLine(fullText);
    if (companyLine) {
      fields.dba = this.cleanCompanyName(companyLine);
      fields.mid = this.extractMIDFromCompanyLine(companyLine);
    }

    // Processing Volume — appears as a standalone dollar amount near "Processing Volume"
    fields.totalVolume = this.extractProcessingVolume(fullText);

    // Total Revenue Lost as the fee equivalent
    fields.totalFees = this.extractRevenueLost(fullText);

    // Statement period from "Based on: December 2025"
    fields.statementPeriod = this.extractBasedOnPeriod(fullText);

    // Effective rate
    if (fields.totalVolume && fields.totalVolume > 0 && fields.totalFees) {
      fields.effectiveRate = fields.totalFees / fields.totalVolume;
    }

    // These are our own audit reports, not processor statements — mark as such
    fields.processorDetected = "WeAudit Report";

    return fields;
  }

  private extractCompanyLine(fullText: string): string | undefined {
    // Look for lines that match the company name pattern with L2/L3 level tags
    // These appear on their own line, often near "Processing Volume" or "Based on"
    const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Match: "Company Name - L2 -XXXX" or "Company Name - XXXX - L3" or "Company Name L3"
      if (/\bL[23]\b/i.test(line) && !/^#|^Based|^Processing|^Total|^Processor|^Many|^Please|^Your|^Discount|^Overall|^Tax|^Missing|^Delayed/i.test(line)) {
        // Exclude downgrade data lines (they have $ amounts at the start after a number)
        if (/^\d+\s+\$/.test(line)) continue;
        // Exclude header/template lines
        if (/# of Trans/.test(line)) continue;
        // Exclude percentage-only lines
        if (/^\d+\.\d+%$/.test(line)) continue;
        return line;
      }
    }
    return undefined;
  }

  private cleanCompanyName(companyLine: string): string {
    // Remove the L2/L3 suffix and MID to get just the company name
    // "Patriot Flooring Supplies - L2 -0880" → "Patriot Flooring Supplies"
    // "Superior Industrial - 3881 - L3" → "Superior Industrial"
    // "Shore Distributors L3" → "Shore Distributors"
    let name = companyLine
      .replace(/\s*-?\s*L[23]\s*-?\s*/gi, " ")  // Remove L2/L3
      .replace(/\s*-?\s*\d{3,12}\s*/g, " ")      // Remove MID digits
      .replace(/\s+/g, " ")
      .trim();
    // Remove trailing dash/spaces
    name = name.replace(/\s*-\s*$/, "").trim();
    return name;
  }

  private extractMIDFromCompanyLine(companyLine: string): string | undefined {
    // Extract the numeric MID from the company line
    // "Patriot Flooring Supplies - L2 -0880" → "0880"
    // "Superior Industrial - 3881 - L3" → "3881"
    // "Plywood Supply 1882 - L2" → "1882"
    // "Shore Distributors L3" → undefined (no MID)
    const match = companyLine.match(/(\d{3,12})/);
    return match ? match[1] : undefined;
  }

  private extractProcessingVolume(fullText: string): number | undefined {
    // The processing volume appears as a standalone dollar amount or bare number.
    // In these audit PDFs, "Processing Volume" can be far from the actual number
    // (sometimes 30+ lines apart due to interleaved table headers).
    // Strategy: find ALL standalone amounts, then pick the largest one as volume.
    const lines = fullText.split("\n").map(l => l.trim());

    let candidates: number[] = [];

    for (const line of lines) {
      // Match standalone dollar amounts (e.g., "$511,722.96")
      const dollarMatch = line.match(/^\$([\d,]+\.?\d*)$/);
      if (dollarMatch) {
        candidates.push(this.parseAmount("$" + dollarMatch[1]));
        continue;
      }
      // Match bare numbers on their own line (e.g., "1,341,547.7")
      const bareMatch = line.match(/^([\d,]{4,}\.?\d*)$/);
      if (bareMatch) {
        candidates.push(this.parseAmount("$" + bareMatch[1]));
      }
    }

    // Filter to amounts that look like processing volume (> $1K)
    // and pick the largest — the processing volume is always the biggest standalone number
    candidates = candidates.filter(v => v > 1000);
    if (candidates.length > 0) {
      return Math.max(...candidates);
    }

    return undefined;
  }

  private extractRevenueLost(fullText: string): number | undefined {
    // "Total Revenue Lost 	$1,232.39" or "Total Revenue Lost \t$310.75"
    const match = fullText.match(/Total\s*Revenue\s*Lost\s+\$([\d,]+\.?\d*)/i);
    if (match) return this.parseAmount("$" + match[1]);
    return undefined;
  }

  private extractBasedOnPeriod(fullText: string): string | undefined {
    // "Based on: 	December 2025"
    const match = fullText.match(/Based\s*on:\s*(\w+\s+\d{4})/i);
    if (match) return match[1];
    return undefined;
  }
}
