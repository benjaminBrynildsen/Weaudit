import type { ParsedPage } from "./parser";
import { GenericParser } from './parsers/generic-parser';

// Type definitions - keep for backward compatibility
export interface NormalizedLine {
  raw: string;
  amount: number;
  rate: number;
  page: number;
  lineNum: number;
  amountIsVolume: boolean;
  // Underlying transaction count when known (audit-report PDFs supply it
  // via the "# of Trans" column). Optional; defaults to 1 when absent.
  transactionCount?: number;
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
 * Legacy function - delegates to GenericParser for backward compatibility
 * New code should use StatementParserFactory.createParser() instead
 */
export function normalizePages(pages: ParsedPage[]): NormalizedLine[] {
  const parser = new GenericParser({ processorName: 'Generic' });
  return parser.normalizePages(pages);
}

/**
 * Legacy function - delegates to GenericParser for backward compatibility
 * New code should use StatementParserFactory.createParser() instead
 */
export function extractFields(pages: ParsedPage[]): ExtractedFields {
  const parser = new GenericParser({ processorName: 'Generic' });
  return parser.extractFields(pages);
}
