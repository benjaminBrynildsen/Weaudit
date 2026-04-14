/**
 * Global abbreviation dictionary for interchange category matching
 * Maps abbreviated terms to their standard/full forms
 * Applied during line normalization BEFORE keyword matching
 */
export const INTERCHANGE_ABBREVIATIONS: Record<string, string[]> = {
  // Tier abbreviations - all map to T
  "TR": ["T"],           // TR1 → T1, TR2 → T2, etc.
  "TIER": ["T"],         // TIER1 → T1, TIER 1 → T 1

  // Product abbreviations
  "PRD": ["PRODUCT", "PROD"],
  "PROD": ["PRODUCT"],

  // Data Rate abbreviations
  "DT": ["DATA"],
  "RT": ["RATE"],

  // Level abbreviations
  "LVL": ["LEVEL", "L"],
  "L": ["LEVEL"],        // L2 → LEVEL2

  // Commercial abbreviations
  "COMM": ["COMMERCIAL", "COMML"],
  "COMML": ["COMMERCIAL"],

  // Card type abbreviations
  "BUS": ["BUSINESS"],   // Already used but include for completeness
  "CORP": ["CORPORATE"], // Already used
  "PUR": ["PURCHASING", "PURCH"],
  "PURCH": ["PURCHASING"],

  // Card Not Present abbreviations
  "CNP": ["CARD NOT PRESENT"],
  "CPS": ["CARD PRESENT"],

  // Merit/Standard abbreviations
  "STD": ["STANDARD"],
  "MRT": ["MERIT"],

  // Other common abbreviations
  "QUAL": ["QUALIFIED"],
  "NONQUAL": ["NON QUALIFIED", "NON QUAL"],
  "NQUAL": ["NON QUALIFIED"],
  "REG": ["REGULATED", "REGULAR"],
  "UNREG": ["UNREGULATED"],
  "DOMSTC": ["DOMESTIC"],
  "DOM": ["DOMESTIC"],
  "INTL": ["INTERNATIONAL"],

  // Signature abbreviations
  "SIG": ["SIGNATURE"],
  "SIGN": ["SIGNATURE"],

  // Preferred abbreviations
  "PREF": ["PREFERRED"],

  // Rewards abbreviations
  "RWD": ["REWARDS"],
  "RWDS": ["REWARDS"],
};

/**
 * Patterns that should be normalized as a unit
 * Applied before individual abbreviation expansion
 */
export const PATTERN_NORMALIZATIONS: Array<[RegExp, string]> = [
  // Normalize "TR1", "TR2", etc. to "T1", "T2", etc.
  [/\bTR(\d+)\b/gi, "T$1"],
  [/\bTIER\s*(\d+)\b/gi, "T$1"],

  // Normalize "PRD 1" to "PRODUCT 1"
  [/\bPRD\s+(\d+)\b/gi, "PRODUCT $1"],

  // Normalize "LVL 2" to "LEVEL 2"
  [/\bLVL\s+(\d+)\b/gi, "LEVEL $1"],
  [/\bL(\d+)\b/gi, "LEVEL$1"],  // L2 → LEVEL2

  // Normalize "DT RT" to "DATA RATE"
  [/\bDT\s+RT\b/gi, "DATA RATE"],

  // Normalize "DATA RT" to "DATA RATE"
  [/\bDATA\s+RT\b/gi, "DATA RATE"],
];

/**
 * Apply abbreviation normalization to a line of text
 * This expands abbreviations to their full/standard forms
 * to improve matching against rule keywords
 *
 * Block-by-block approach: Creates clean variants for each abbreviation
 * All variants are concatenated to maximize matching probability
 */
export function expandAbbreviations(line: string): string {
  const variants = new Set<string>();

  // Always include the original line
  variants.add(line);

  // Pre-process: also create a variant with hyphens normalized to spaces
  // so "VI-PURCH" becomes "VI PURCH" and abbreviation lookup works
  const dehyphenated = line.replace(/-/g, " ");
  if (dehyphenated !== line) {
    variants.add(dehyphenated);
  }

  // Step 1: Apply pattern-based normalizations to both original and dehyphenated
  for (const source of [line, dehyphenated]) {
    for (const [pattern, replacement] of PATTERN_NORMALIZATIONS) {
      if (pattern.test(source)) {
        const normalized = source.replace(pattern, replacement);
        variants.add(normalized);
      }
    }
  }

  // Step 2: Apply word-by-word abbreviation expansion
  // For each word that has an abbreviation, create variants
  const words = dehyphenated.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toUpperCase();
    const expansions = INTERCHANGE_ABBREVIATIONS[word];

    if (expansions && expansions.length > 0) {
      // For each expansion, create a new variant with that word replaced
      for (const expansion of expansions) {
        const newWords = [...words];
        newWords[i] = expansion;
        variants.add(newWords.join(" "));
      }
    }
  }

  // Step 3: Create combination variants (pattern + word expansions)
  // For pattern-normalized variants, also apply word expansions
  const variantsArray = Array.from(variants);
  for (const variant of variantsArray) {
    const words = variant.split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toUpperCase();
      const expansions = INTERCHANGE_ABBREVIATIONS[word];

      if (expansions && expansions.length > 0) {
        for (const expansion of expansions) {
          const newWords = [...words];
          newWords[i] = expansion;
          variants.add(newWords.join(" "));
        }
      }
    }
  }

  // Return all variants concatenated with spaces
  return Array.from(variants).join(" ");
}
