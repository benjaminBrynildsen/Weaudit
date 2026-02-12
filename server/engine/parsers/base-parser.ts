import type { ParsedPage } from "../parser";

export interface ParserConfig {
  processorName: string;
}

export interface NormalizedLine {
  raw: string;
  amount: number;
  rate: number;
  page: number;
  lineNum: number;
  amountIsVolume: boolean;
}

export interface ExtractedFields {
  mid?: string;
  dba?: string;
  statementPeriod?: string;
  totalVolume?: number;
  totalFees?: number;
  amexVolume?: number;
  amexFees?: number;
  effectiveRate?: number;
  processorDetected?: string;
}

/**
 * Base abstract class for processor-specific statement parsing
 * Each processor can extend this and override specific methods
 */
export abstract class BaseStatementParser {
  constructor(protected config: ParserConfig) {}

  // Main parsing methods - must implement
  abstract normalizePages(pages: ParsedPage[]): NormalizedLine[];
  abstract extractFields(pages: ParsedPage[]): ExtractedFields;

  // Protected helpers - can override for processor-specific behavior
  protected parseAmount(s: string): number {
    const cleaned = s.replace(/[$,]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  protected parseRate(s: string): number {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  // Field extraction helpers with default patterns
  protected extractMID(fullText: string): string | undefined {
    const patterns = [
      /(?:MID|MERCHANT\s*(?:ID|#|NUMBER))\s*[:\-#]?\s*([\dA-Z-]{5,20})/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return m[1].trim();
    }
    return undefined;
  }

  protected extractDBA(fullText: string): string | undefined {
    const patterns = [
      /(?:DBA|DOING\s*BUSINESS\s*AS)\s*[:\-]?\s*(.{3,50})/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return m[1].trim();
    }
    return undefined;
  }

  protected extractStatementPeriod(fullText: string): string | undefined {
    const m = fullText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (m) return `${m[1]} – ${m[2]}`;
    return undefined;
  }

  protected extractTotalVolume(fullText: string): number | undefined {
    const patterns = [
      /TOTAL\s+(?:SUBMITTED\s+)?VOLUME\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /GROSS\s+SALES\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  protected extractTotalFees(fullText: string): number | undefined {
    const patterns = [
      /TOTAL\s+(?:MONTHLY\s+)?FEES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /TOTAL\s+CHARGES\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  protected extractAmexVolume(fullText: string): number | undefined {
    const patterns = [
      /(?:AMEX|AMERICAN\s+EXPRESS).*?VOLUME\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  protected extractAmexFees(fullText: string): number | undefined {
    const patterns = [
      /(?:AMEX|AMERICAN\s+EXPRESS).*?FEES?\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }
}
