/**
 * Section Detection for Statement Parsing
 *
 * Different processors organize statements differently. We need to identify
 * the "Interchange Charges" or "Pending Interchange" section where downgrades
 * are listed, and only scan those lines for downgrade detection.
 */

import type { NormalizedLine } from "./normalizer";

export interface SectionBoundary {
  startLine: number;
  endLine: number;
  sectionName: string;
}

/**
 * Section header patterns for different processors
 * These identify where the interchange charges/downgrades are listed
 */
const INTERCHANGE_SECTION_HEADERS = [
  // CardConnect / Fiserv - look for the detail section, not the total
  /^Interchange\s+\d{2}\/\d{2}\/\d{2}/i,  // "Interchange 12/31/25" style headers
  /PENDING\s+INTERCHANGE/i,
  /INTERCHANGE\s+DETAIL/i,

  // Elavon
  /INTERCHANGE\s+FEES\s+DETAIL/i,

  // General patterns
  /INTERCHANGE\s+SUMMARY/i,
  /CARD\s+TYPE\s+DETAIL/i,
];

/**
 * Section end patterns - indicates the interchange section has ended
 */
const SECTION_END_PATTERNS = [
  /^TOTAL/i,
  /^GRAND\s+TOTAL/i,
  /^SUMMARY/i,
  /^SERVICE\s+CHARGES/i,
  /^FEES/i,
  /^MONTHLY\s+FEES/i,
  /^\s*$/,  // Empty line can indicate section end
];

/**
 * Detect the interchange section boundaries in the statement
 */
export function detectInterchangeSection(
  lines: NormalizedLine[],
  fullText: string
): SectionBoundary | null {
  const textLines = fullText.split("\n");

  let sectionStart = -1;
  let sectionName = "";

  // Find section start
  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();

    for (const pattern of INTERCHANGE_SECTION_HEADERS) {
      if (pattern.test(line)) {
        sectionStart = i;
        sectionName = line;
        break;
      }
    }

    if (sectionStart >= 0) break;
  }

  if (sectionStart < 0) {
    // No interchange section found
    return null;
  }

  // Find section end (look for next major section or total line)
  let sectionEnd = textLines.length - 1;
  let consecutiveEmptyLines = 0;

  for (let i = sectionStart + 1; i < textLines.length; i++) {
    const line = textLines[i].trim();

    // Track empty lines
    if (line.length === 0) {
      consecutiveEmptyLines++;
      // 3+ consecutive empty lines likely indicates section break
      if (consecutiveEmptyLines >= 3) {
        sectionEnd = i;
        break;
      }
      continue;
    } else {
      consecutiveEmptyLines = 0;
    }

    // Check for explicit section end markers
    for (const pattern of SECTION_END_PATTERNS) {
      if (pattern.test(line)) {
        // Don't end on "TOTAL" if it's part of the interchange section
        // (like "INTERCHANGE TOTAL")
        if (/TOTAL/i.test(line) && /INTERCHANGE/i.test(line)) {
          continue;
        }
        sectionEnd = i - 1;
        break;
      }
    }

    if (sectionEnd < textLines.length - 1) break;
  }

  return {
    startLine: sectionStart,
    endLine: sectionEnd,
    sectionName,
  };
}

/**
 * Filter normalized lines to only those within the interchange section
 *
 * Simplified approach: Look for grid lines (3+ amounts) that contain
 * interchange category keywords (VI-, MC-, VISA, MASTERCARD, etc.)
 */
export function filterInterchangeLines(
  lines: NormalizedLine[],
  section: SectionBoundary | null
): NormalizedLine[] {
  // Use grid line detection: lines with 3+ dollar amounts are typically
  // from the interchange summary grid section
  const gridLines = lines.filter(line => line.amountIsVolume);

  if (gridLines.length > 0) {
    console.log(`  → Found ${gridLines.length} grid lines (interchange summary)`);
    return gridLines;
  }

  // Fallback: filter by interchange keywords
  const keywordLines = lines.filter(line => {
    const upper = line.raw.toUpperCase();
    return (
      /\b(VI-|MC-|VISA|MASTERCARD|AMEX)\b/.test(upper) &&
      !/TOTAL|GRAND|SUMMARY|^DEBIT\s+CARD\s+TOTAL/.test(upper)
    );
  });

  if (keywordLines.length > 0) {
    console.log(`  → Found ${keywordLines.length} interchange lines (keyword match)`);
    return keywordLines;
  }

  // Last resort: return all lines
  console.log(`  → No grid or keyword lines found, scanning all ${lines.length} lines`);
  return lines;
}

/**
 * For debugging: show section boundaries
 */
export function debugSection(
  section: SectionBoundary | null,
  fullText: string
): void {
  if (!section) {
    console.log("No interchange section detected");
    return;
  }

  const lines = fullText.split("\n");
  console.log(`\nInterchange Section: "${section.sectionName}"`);
  console.log(`Lines ${section.startLine} - ${section.endLine}\n`);
  console.log("First 5 lines:");
  lines.slice(section.startLine, section.startLine + 5).forEach((line, i) => {
    console.log(`  ${section.startLine + i}: ${line}`);
  });
  console.log("...");
  console.log("Last 5 lines:");
  lines.slice(Math.max(section.startLine, section.endLine - 4), section.endLine + 1).forEach((line, i) => {
    const lineNum = Math.max(section.startLine, section.endLine - 4) + i;
    console.log(`  ${lineNum}: ${line}`);
  });
}
