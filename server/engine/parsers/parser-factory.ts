import { BaseStatementParser } from './base-parser';
import { GenericParser } from './generic-parser';
import { FiservParser } from './fiserv-parser';

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

    // Future processors can be added here:
    //
    // CardConnect
    // if (/cardconnect|cardpointe/i.test(normalized)) {
    //   return new CardConnectParser({ processorName });
    // }
    //
    // Elavon / US Bank
    // if (/elavon|us[\s-]*bank/i.test(normalized)) {
    //   return new ElavonParser({ processorName });
    // }
    //
    // Worldpay
    // if (/worldpay|world[\s-]*pay/i.test(normalized)) {
    //   return new WorldpayParser({ processorName });
    // }

    // Default to generic parser for unknown processors
    console.log(`  → Using GenericParser for ${processorName}`);
    return new GenericParser({ processorName });
  }
}
