import { BaseStatementParser, ExtractedFields, NormalizedLine } from './base-parser';
import type { ParsedPage } from '../parser';

/**
 * Generic parser - uses standard parsing logic that works for most processors
 * This is the default fallback parser when no processor-specific parser exists
 */
export class GenericParser extends BaseStatementParser {
  private readonly AMOUNT_RE = /\$[\d,]+\.?\d*/g;
  private readonly RATE_RE = /(\d+\.?\d*)\s*%/g;
  // Bare decimal rate (no % sign) — typically in grid lines like "0.0315"
  // Use negative lookbehind to exclude dollar amounts like "$0.100"
  private readonly BARE_RATE_RE = /(?<!\$)(0\.\d{3,4})\b/g;

  normalizePages(pages: ParsedPage[]): NormalizedLine[] {
    const lines: NormalizedLine[] = [];

    for (const page of pages) {
      const textLines = page.text.split("\n");
      for (let i = 0; i < textLines.length; i++) {
        const raw = textLines[i].trim();
        if (!raw || raw.length < 5) continue;

        const amounts = raw.match(this.AMOUNT_RE);
        const rates = raw.match(this.RATE_RE);
        const bareRates = raw.match(this.BARE_RATE_RE);

        // For interchange grid lines (3+ dollar amounts), the first amount is
        // the sales volume and the last is the fee. Use volume as the primary
        // amount since revenue-lost = volume × spread.
        const isGridLine = amounts != null && amounts.length >= 3;
        const amount = amounts
          ? (isGridLine ? this.parseAmount(amounts[0]) : this.parseAmount(amounts[amounts.length - 1]))
          : 0;

        // Extract rate:
        // For grid lines: prefer bare decimal (0.0315 = 3.15%), as the % values
        // are often transaction counts or other metrics
        // For fee lines: use the % format
        let rate = 0;
        if (isGridLine && bareRates && bareRates.length > 0) {
          // Grid line: bare decimal is the actual interchange rate
          rate = this.parseRate(bareRates[bareRates.length - 1]) * 100;
        } else if (rates && rates.length > 0) {
          // Fee line or no bare rate: use % format
          const rateMatch = rates[rates.length - 1].replace("%", "").trim();
          rate = this.parseRate(rateMatch);
        } else if (bareRates && bareRates.length > 0) {
          // Fallback: bare decimal if no % found
          rate = this.parseRate(bareRates[bareRates.length - 1]) * 100;
        }

        // Only include lines that have an amount or rate (fee-like lines)
        if (amount > 0 || rate > 0) {
          lines.push({
            raw,
            amount,
            rate,
            page: page.pageNum,
            lineNum: i + 1,
            amountIsVolume: isGridLine,
          });
        }
      }
    }

    return lines;
  }

  extractFields(pages: ParsedPage[]): ExtractedFields {
    const fullText = pages.map((p) => p.text).join("\n");
    const fields: ExtractedFields = {};

    // Use base class extractors
    fields.mid = this.extractMID(fullText);
    fields.dba = this.extractDBA(fullText);
    fields.statementPeriod = this.extractStatementPeriod(fullText);
    fields.totalVolume = this.extractTotalVolumeExtended(fullText);
    fields.totalFees = this.extractTotalFeesExtended(fullText);
    fields.amexVolume = this.extractAmexVolumeExtended(fullText);
    fields.amexFees = this.extractAmexFees(fullText);

    // Calculate effective rate excluding AMEX (per training: Volume = Total − AMEX)
    const adjVolume = (fields.totalVolume || 0) - (fields.amexVolume || 0);
    const adjFees = (fields.totalFees || 0) - (fields.amexFees || 0);
    if (adjVolume > 0) {
      fields.effectiveRate = adjFees / adjVolume;
    }

    // Processor detection
    fields.processorDetected = this.detectProcessor(fullText);

    // DBA fallback: look for the merchant name after "Phone" line on page 1
    // CardConnect statements put the business name on the line after the phone
    if (!fields.dba) {
      const phoneMatch = fullText.match(/Phone\s*[-–]?\s*[\d-]+\s*\n([A-Z][A-Z &']{2,50})/);
      if (phoneMatch) fields.dba = phoneMatch[1].trim();
    }

    return fields;
  }

  // Extended volume extraction with more patterns
  protected extractTotalVolumeExtended(fullText: string): number | undefined {
    const patterns = [
      /TOTAL\s*AMOUNT\s*SUBMITTED\s*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*(?:SUBMITTED\s*)?VOLUME\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*SALES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /NET\s*VOLUME\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  // Extended fees extraction with more patterns
  protected extractTotalFeesExtended(fullText: string): number | undefined {
    const patterns = [
      /FEES\s*CHARGED\s*[-–−]?\s*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*\(SERVICE\s*CHARGES.*?\)\s*[-–−]?\s*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*(?:MONTHLY\s*)?FEES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /TOTAL\s*CHARGES\s*[:\s]*\$([\d,]+\.?\d*)/i,
      /NET\s*FEES\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  // Extended AMEX volume extraction
  protected extractAmexVolumeExtended(fullText: string): number | undefined {
    const patterns = [
      /AMEX\s*ACQ\s*TOTAL\s*\$([\d,]+\.?\d*)/i,
      /AMEX\s*ACQ\s+\$([\d,]+\.?\d*)/i,
      /AMEX\s*(?:VOLUME|SALES)\s*[:\s]*\$([\d,]+\.?\d*)/i,
    ];
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m) return this.parseAmount("$" + m[1]);
    }
    return undefined;
  }

  // Processor detection logic
  protected detectProcessor(fullText: string): string {
    const processorHints: [RegExp, string][] = [
      [/CARDCONNECT|CARDPOINTE|COMMERCECONTROL/i, "CardConnect"],
      [/FISERV|FIRST\s*DATA/i, "Fiserv"],
      [/ELAVON|US\s*BANK/i, "Elavon"],
      [/WORLDPAY|WORLD\s*PAY/i, "Worldpay"],
      [/VERSAPAY|VERSA\s*PAY/i, "VersaPay"],
      [/WELLS\s*FARGO/i, "Wells Fargo"],
      [/BANK\s*OF\s*AMERICA|BOA|BOFA/i, "Bank of America"],
      [/CHASE\s*MERCHANT/i, "Chase"],
      [/STRIPE/i, "Stripe"],
      [/SQUARE/i, "Square"],
      [/NORTH\s*SUMMIT/i, "North Summit"],
      [/COCARD|CO\s*CARD/i, "CoCard"],
      [/SOLUPAY|SOLU\s*PAY/i, "Solupay"],
      [/PNC|KEYBANK|KEY\s*BANK/i, "PNC / KeyBank"],
    ];

    for (const [re, name] of processorHints) {
      if (re.test(fullText)) {
        return name;
      }
    }

    return "";
  }
}
