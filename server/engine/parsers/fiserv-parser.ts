import { GenericParser } from './generic-parser';
import { ExtractedFields } from './base-parser';
import type { ParsedPage } from '../parser';

/**
 * Fiserv-specific parser
 * Handles Fiserv Type 2 statements that have both "Fees" and "Pending Fees" sections
 * Must use ONLY "Pending Fees" section to avoid double-counting
 */
export class FiservParser extends GenericParser {
  private hasPendingFeesSection: boolean = false;

  extractFields(pages: ParsedPage[]): ExtractedFields {
    const fullText = pages.map(p => p.text).join("\n");

    // Detect Fiserv Type 2 (has "Pending Fees" section)
    this.hasPendingFeesSection = /PENDING\s+FEES/i.test(fullText);

    // Use generic extraction for most fields
    const fields = super.extractFields(pages);

    // Override total fees extraction for Type 2
    if (this.hasPendingFeesSection) {
      console.log("  → Fiserv Type 2 detected: using Pending Fees section");
      const pendingFees = this.extractTotalFeesFromPendingSection(fullText);
      if (pendingFees !== undefined) {
        fields.totalFees = pendingFees;

        // Recalculate effective rate with corrected fees
        const adjVolume = (fields.totalVolume || 0) - (fields.amexVolume || 0);
        const adjFees = (fields.totalFees || 0) - (fields.amexFees || 0);
        if (adjVolume > 0) {
          fields.effectiveRate = adjFees / adjVolume;
        }
      }
    }

    return fields;
  }

  /**
   * Extract total fees from "Pending Fees" section only
   * Fiserv Type 2 statements have both "Fees" and "Pending Fees" sections
   * Training docs specify: use ONLY "Pending Fees" section to prevent double-counting
   */
  private extractTotalFeesFromPendingSection(fullText: string): number | undefined {
    // Find the "Pending Fees" section
    const pendingIndex = fullText.search(/PENDING\s+FEES/i);
    if (pendingIndex < 0) return undefined;

    // Extract only from the Pending Fees section onward
    const pendingSection = fullText.slice(pendingIndex);

    // Look for total fees patterns in this section only
    const patterns = [
      /FEES\s*CHARGED\s*[-–−]?\s*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*(?:MONTHLY\s*)?FEES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*CHARGES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /NET\s*FEES\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];

    for (const pat of patterns) {
      const m = pendingSection.match(pat);
      if (m) {
        const amount = this.parseAmount("$" + m[1]);
        console.log(`  → Extracted fees from Pending Fees section: $${m[1]}`);
        return amount;
      }
    }

    return undefined;
  }
}
