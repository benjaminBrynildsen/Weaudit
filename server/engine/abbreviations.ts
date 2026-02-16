/**
 * Common abbreviation expansions for payment processing fee descriptions.
 * Maps short-form processor labels to their full standard equivalents
 * so that downstream keyword matching is more reliable.
 */

const ABBREVIATION_MAP: [RegExp, string][] = [
  // Card brands
  [/\bVS\b/gi, "VISA"],
  [/\bMC\b/gi, "MASTERCARD"],
  [/\bDS\b/gi, "DISCOVER"],
  [/\bAX\b/gi, "AMEX"],
  [/\bAMEX\b/gi, "AMERICAN EXPRESS"],
  [/\bJCB\b/gi, "JCB"],
  [/\bDIN\b/gi, "DINERS"],
  [/\bDC\b/gi, "DINERS CLUB"],

  // Transaction types
  [/\bCNP\b/gi, "CARD NOT PRESENT"],
  [/\bCP\b/gi, "CARD PRESENT"],
  [/\bKE\b/gi, "KEYED"],
  [/\bSW\b/gi, "SWIPED"],
  [/\bECOM\b/gi, "ECOMMERCE"],

  // Card categories
  [/\bCOM\b/gi, "COMMERCIAL"],
  [/\bCORP\b/gi, "CORPORATE"],
  [/\bPUR\b/gi, "PURCHASING"],
  [/\bBUS\b/gi, "BUSINESS"],
  [/\bGSA\b/gi, "GSA"],
  [/\bPREM\b/gi, "PREMIUM"],
  [/\bENH\b/gi, "ENHANCED"],
  [/\bSTD\b/gi, "STANDARD"],
  [/\bRWD\b/gi, "REWARDS"],
  [/\bREW\b/gi, "REWARDS"],
  [/\bSIG\b/gi, "SIGNATURE"],
  [/\bINF\b/gi, "INFINITE"],
  [/\bPREF\b/gi, "PREFERRED"],
  [/\bWLD\b/gi, "WORLD"],
  [/\bWRLD\b/gi, "WORLD"],
  [/\bELT\b/gi, "ELITE"],
  [/\bTRD\b/gi, "TRADITIONAL"],
  [/\bREG\b/gi, "REGULATED"],
  [/\bUNREG\b/gi, "UNREGULATED"],
  [/\bDBT\b/gi, "DEBIT"],
  [/\bCRT\b/gi, "CREDIT"],
  [/\bCRD\b/gi, "CARD"],
  [/\bPREPD\b/gi, "PREPAID"],
  [/\bPPD\b/gi, "PREPAID"],
  [/\bFLT\b/gi, "FLEET"],

  // Qualification levels
  [/\bQUAL\b/gi, "QUALIFIED"],
  [/\bMQUAL\b/gi, "MID-QUALIFIED"],
  [/\bNQUAL\b/gi, "NON-QUALIFIED"],
  [/\bMID[\s-]*Q\b/gi, "MID-QUALIFIED"],
  [/\bNON[\s-]*Q\b/gi, "NON-QUALIFIED"],
  [/\bDNG\b/gi, "DOWNGRADE"],
  [/\bDNGR\b/gi, "DOWNGRADE"],
  [/\bSURCH\b/gi, "SURCHARGE"],

  // Fee types
  [/\bASSMT\b/gi, "ASSESSMENT"],
  [/\bASMT\b/gi, "ASSESSMENT"],
  [/\bINTRCH\b/gi, "INTERCHANGE"],
  [/\bINT\b/gi, "INTERCHANGE"],
  [/\bXCHG\b/gi, "INTERCHANGE"],
  [/\bTXN\b/gi, "TRANSACTION"],
  [/\bTRNS\b/gi, "TRANSACTION"],
  [/\bAUTH\b/gi, "AUTHORIZATION"],
  [/\bBTCH\b/gi, "BATCH"],
  [/\bMTHLY\b/gi, "MONTHLY"],
  [/\bMO\b/gi, "MONTHLY"],
  [/\bANNL\b/gi, "ANNUAL"],
  [/\bSTMT\b/gi, "STATEMENT"],
  [/\bSVC\b/gi, "SERVICE"],
  [/\bPROC\b/gi, "PROCESSING"],
  [/\bACCS\b/gi, "ACCESS"],
  [/\bRGL\b/gi, "REGULATORY"],
];

/**
 * Expand common payment-processing abbreviations in a fee description string.
 * Returns the original string with abbreviated tokens replaced by their
 * full equivalents, making downstream keyword matching more reliable.
 */
export function expandAbbreviations(raw: string): string {
  let result = raw;
  for (const [pattern, replacement] of ABBREVIATION_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
