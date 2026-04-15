import { BaseStatementParser } from './base-parser';
import { GenericParser } from './generic-parser';
import { FiservParser } from './fiserv-parser';
import { AuditReportParser } from './audit-report-parser';
import type { ParsedPage } from '../parser';

/**
 * Factory for creating processor-specific statement parsers
 * Returns the appropriate parser based on the detected or specified processor name
 */
export class StatementParserFactory {
  /**
   * Create a parser instance based on processor name
   * @param processorName - Detected or specified processor name (optional)
   * @returns Parser instance (processor-specific or generic fallback)
   */
  static createParser(processorName?: string): BaseStatementParser {
    if (!processorName) {
      return new GenericParser({ processorName: 'Generic' });
    }

    const normalized = processorName.toLowerCase();

    // Fiserv / First Data
    if (/fiserv|first[\s-]*data/i.test(normalized)) {
      console.log("  → Using FiservParser");
      return new FiservParser({ processorName });
    }

    // Default to generic parser for unknown processors
    console.log(`  → Using GenericParser for ${processorName}`);
    return new GenericParser({ processorName });
  }

  /**
   * Detect if the PDF is an internal audit report and return the appropriate parser.
   * Call this before createParser() — if it returns a parser, use it instead.
   */
  static detectAuditReport(pages: ParsedPage[]): AuditReportParser | null {
    const fullText = pages.map(p => p.text).join("\n");
    if (AuditReportParser.isAuditReport(fullText)) {
      console.log("  → Detected internal audit report PDF — using AuditReportParser");
      return new AuditReportParser({ processorName: 'WeAudit Report' });
    }
    return null;
  }
}
