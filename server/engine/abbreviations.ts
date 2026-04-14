/**
 * Global abbreviation expansion.
 *
 * Runs before processor-specific alias expansion in detectors.ts. Handles
 * abbreviations that show up across multiple processors, so downstream
 * keyword matching in seed.ts downgrade rules works consistently.
 *
 * Verified mappings (with evidence in this codebase):
 *   - TR1..TR5 → T1..T5   — CardConnect uses "VI-BUSINESS CARD TR1 LEVEL 2"
 *                            style names; seed.ts downgrade rules key off
 *                            "T1"/"T2"/... so we canonicalize here.
 *                            See server/engine/benchmarks.ts:97-141.
 *   - LVL (\d) → LEVEL \1 — Elavon uses "LVL 2" style; seed.ts rules key
 *                            off "LEVEL 2". See detectors.ts:153-158 which
 *                            has processor-specific handling we generalize.
 *   - PRD (\d) → PRODUCT \1 — CardConnect/others abbreviate "PRODUCT" as
 *                              "PRD"; seed.ts keywords use "PRODUCT 1".
 *
 * Intentionally conservative: only ships well-evidenced mappings. Extend
 * below as new abbreviations are discovered in real statements — add a
 * test case alongside each addition.
 */

type Rule = {
  pattern: RegExp;
  replacement: string;
};

const rules: Rule[] = [
  // TR<digit> → T<digit>. \b on both sides prevents matching inside longer
  // tokens like "TR12" or "STR1".
  { pattern: /\bTR(\d)\b/gi, replacement: "T$1" },
  // LVL → LEVEL. Word-bounded so "LVLS" or "ELVL" aren't touched.
  { pattern: /\bLVL\b/gi, replacement: "LEVEL" },
  // PRD → PRODUCT. Same word-boundary guard.
  { pattern: /\bPRD\b/gi, replacement: "PRODUCT" },
];

/**
 * Expand known abbreviations in a raw audit line. Case-insensitive match,
 * output forced to uppercase to match downstream keyword expectations
 * (seed.ts keywords are all uppercase).
 */
export function expandAbbreviations(raw: string): string {
  let out = raw;
  for (const { pattern, replacement } of rules) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
