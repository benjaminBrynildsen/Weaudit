import type { NormalizedLine } from "./normalizer";
import type { DowngradeRule, Finding, FindingType } from "../storage";
import { INTERCHANGE_BENCHMARKS, type InterchangeBenchmark } from "./benchmarks";

// ── Non-PCI Detection ────────────────────────────────────────────────────────

const NON_PCI_PATTERNS = [
  /NON[\s-]*PCI/i,
  /PCI\s*(?:NON[\s-]*)?COMPLIANCE/i,
  /NON[\s-]*COMPLIANCE\s*FEE/i,
  /PCI\s*FEE/i,
  /PCI\s*PENALTY/i,
  /NON[\s-]*VALIDATED/i,
];

export interface DetectionResult {
  type: FindingType;
  title: string;
  category: string;
  rawLine: string;
  amount: number;
  rate: number;
  page: number;
  lineNum: number;
  severity: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  reason: string;
  recommendedAction: string;
  targetRate?: number;
  spread?: number;
}

export function detectNonPci(lines: NormalizedLine[]): { results: DetectionResult[]; matchedIndices: Set<number> } {
  const results: DetectionResult[] = [];
  const matchedIndices = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upperRaw = line.raw.toUpperCase();

    for (const pattern of NON_PCI_PATTERNS) {
      if (pattern.test(upperRaw)) {
        matchedIndices.add(i);
        results.push({
          type: "non_pci",
          title: "Non-PCI Compliance Fee",
          category: "PCI & Compliance",
          rawLine: line.raw,
          amount: line.amount,
          rate: line.rate,
          page: line.page,
          lineNum: line.lineNum,
          severity: "High",
          confidence: "High",
          reason: "Fee matches known PCI non-compliance penalty patterns",
          recommendedAction: "Complete PCI SAQ, submit attestation, and request refund for recent months",
          targetRate: 0,
          spread: line.rate,
        });
        break; // one match per line is enough
      }
    }
  }

  return { results, matchedIndices };
}

// ── Processor-Specific Category Aliases ──────────────────────────────────────

/** CardConnect uses "IC" prefix and slightly different category names.
 *  This map translates CardConnect names to standard keywords our rules expect. */
const CARDCONNECT_ALIASES: [RegExp, string][] = [
  // Visa Business Card with Tier/Level (note: "BUSINESS CARD" not just "BUS")
  [/VI[-\s]BUSINESS\s+CARD\s+TR(\d+)\s+LEVEL\s+(\d+)/i, "VISA BUS T$1 LEVEL $2"],
  // Visa Purchasing
  [/VI[-\s]PURCHASING\s+CREDIT\s+PRODUCT\s+(\d+)/i, "VISA PURCHASING PRODUCT $1"],
  [/VI[-\s]PURCHASING\s+CARD\s+PRESENT/i, "VISA PURCHASING CARD PRESENT"],
  // Visa Corporate
  [/VI[-\s]CORP(?:ORATE)?\s+PRODUCT\s+(\d+)/i, "VISA CORP PRODUCT $1"],
  // Visa Non-Qual variations
  [/VI[-\s]NON\s+QUAL\s+CONSUMER\s+CR/i, "VI NON QUAL CONSUMER CR"],
  [/VI[-\s]NON\s+QUAL\s+BUS\s+CR/i, "VI NON QUAL BUS CR"],
  [/VI[-\s]NON\s+QUAL\s+CORP\s+CR/i, "VI NON QUAL CORP CR"],
  [/VI[-\s]NON\s+QUAL\s+PURCH\s+CR/i, "VI NON QUAL PURCH CR"],
  // Visa Standard
  [/VI[-\s]STANDARD/i, "VISA STANDARD"],
  // Visa EIRF
  [/VI[-\s]EIRF/i, "EIRF"],
  // Visa CNP (Card Not Present)
  [/VI[-\s]CNP/i, "VI CNP"],
  // Mastercard Business Levels
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+DATA\s+RATE/i, "MC BUS LEVEL $1 DATA RATE"],
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+STANDARD/i, "MC BUS LEVEL $1 STANDARD"],
  // Mastercard Corporate
  [/MC[-\s]CORP(?:ORATE)?\s+DATA\s+RATE/i, "MC CORP DATA RATE"],
  [/MC[-\s]CORP(?:ORATE)?\s+CARD\s+STD/i, "MC CORP CARD STD"],
  // Mastercard Purchasing
  [/MC[-\s]PUR(?:CHASING)?\s+CARD\s+STD/i, "MC PUR CARD STD"],
  // Mastercard Fleet
  [/MC[-\s]FLEET\s+STD/i, "MC FLEET STD"],
  // Mastercard High Value
  [/MC[-\s]HIGH\s+VAL(?:UE)?\s+MERIT/i, "MC HIGH VALUE"],
];

/** Elavon/US Bank uses different interchange category names than Fiserv.
 *  This map translates Elavon names to the standard keywords our rules expect. */
const ELAVON_ALIASES: [RegExp, string][] = [
  // Visa Business tiers (COMMCNP = Commercial Card Not Present)
  [/VISA\s+COMMCNP\s+B1/i, "VISA BUS T1 PRODUCT 1"],
  [/VISA\s+COMMCNP\s+B2/i, "VISA BUS T2 PRODUCT 1"],
  [/VISA\s+COMMCNP\s+B3/i, "VISA BUS T3 PRODUCT 1"],
  [/VISA\s+COMMCNP\s+B4/i, "VISA BUS T4 PRODUCT 1"],
  [/VISA\s+COMMCNP\s+B5/i, "VISA BUS T5 PRODUCT 1"],
  // Visa Corporate/Purchasing CNP
  [/VISA\s+COMMCNP\s+C/i, "VISA CORP PRODUCT 1"],
  [/VISA\s+COMMCNP\s+P/i, "VISA PURCHASING PRODUCT 1"],
  // Visa EIRF variants
  [/VISA\s+EIRF\s+DOMESTIC/i, "EIRF NON CPS ALL OTHER"],
  [/VISA\s+STD\b/i, "STANDARD"],
  // Mastercard Business levels (Elavon uses LVL instead of LEVEL)
  [/MC\s+(?:BUS|BUSINESS)\s+LVL?\s*1/i, "MC BUS LEVEL 1 DATA RATE 1"],
  [/MC\s+(?:BUS|BUSINESS)\s+LVL?\s*2/i, "MC BUS LEVEL 2 DATA RATE 1"],
  [/MC\s+(?:BUS|BUSINESS)\s+LVL?\s*3/i, "MC BUS LEVEL 3 DATA RATE 1"],
  [/MC\s+(?:BUS|BUSINESS)\s+LVL?\s*4/i, "MC BUS LEVEL 4 DATA RATE 1"],
  [/MC\s+(?:BUS|BUSINESS)\s+LVL?\s*5/i, "MC BUS LEVEL 5 DATA RATE 1"],
  // Mastercard Corp/Purchasing
  [/MC\s+CORP\s+STD/i, "CORP CARD STD"],
  [/MC\s+PUR\s+STD/i, "PUR CARD STD"],
  [/MC\s+FLEET\s+STD/i, "FLEET STD"],
];

/** Expand processor-specific category names with standard equivalents for keyword matching. */
function expandProcessorAliases(raw: string, processorName?: string): string {
  let expanded = raw;

  // Check CardConnect
  if (processorName && /cardconnect|cardpointe/i.test(processorName)) {
    for (const [pattern, standard] of CARDCONNECT_ALIASES) {
      if (pattern.test(raw)) {
        expanded += " " + standard;
      }
    }
  }

  // Check Elavon
  if (processorName && /elavon|us\s*bank/i.test(processorName)) {
    for (const [pattern, standard] of ELAVON_ALIASES) {
      if (pattern.test(raw)) {
        expanded += " " + standard;
      }
    }
  }

  return expanded;
}

// ── Downgrade Detection ──────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toUpperCase().split(/[\s/(),+\-]+/).filter(Boolean);
}

/** Normalize Roman numerals to digits so "DATA RATE I" matches keyword "DATA RATE 1" */
function normalizeRoman(text: string): string {
  return text
    .replace(/\bIII\b/g, "3")
    .replace(/\bII\b/g, "2")
    .replace(/\bI\b/g, "1");
}

function keywordsMatch(lineTokens: string[], ruleKeywords: string[]): boolean {
  // Join tokens and normalize Roman numerals so DATA RATE I ↔ DATA RATE 1
  const lineUpper = normalizeRoman(lineTokens.join(" "));
  return ruleKeywords.every((kw) => lineUpper.includes(normalizeRoman(kw.toUpperCase())));
}

export function detectDowngrades(
  lines: NormalizedLine[],
  rules: DowngradeRule[],
  excludeIndices: Set<number>,
  processorName?: string,
): { results: DetectionResult[]; matchedIndices: Set<number> } {
  const results: DetectionResult[] = [];
  const matchedIndices = new Set<number>();
  const enabledRules = rules.filter((r) => r.enabled);

  for (let i = 0; i < lines.length; i++) {
    if (excludeIndices.has(i)) continue;

    const line = lines[i];
    // Expand processor-specific category names with standard equivalents
    const matchText = expandProcessorAliases(line.raw, processorName);
    const lineTokens = tokenize(matchText);

    for (const rule of enabledRules) {
      if (keywordsMatch(lineTokens, rule.keywords)) {
        matchedIndices.add(i);

        const actualRate = line.rate || rule.rate;
        const rateSpread = Math.max(0, actualRate - rule.targetRate);

        let severity: "High" | "Medium" | "Low" = "Low";
        if (rateSpread > 1) severity = "High";
        else if (rateSpread >= 0.5) severity = "Medium";

        // Compute revenue lost in dollars.
        // If line is a grid line (3+ dollar amounts), amount = volume:
        //   revenueLost = volume × rateSpread / 100
        // If line is a fee-only line, amount = the fee:
        //   revenueLost = fee × rateSpread / actualRate
        let revenueLost = 0;
        if (rateSpread > 0 && actualRate > 0) {
          if (line.amountIsVolume) {
            revenueLost = line.amount * rateSpread / 100;
          } else {
            revenueLost = line.amount * rateSpread / actualRate;
          }
        }

        results.push({
          type: "downgrade",
          title: `${rule.brand === "V" ? "Visa" : "Mastercard"} - ${rule.name}`,
          category: "Pricing Model",
          rawLine: line.raw,
          amount: line.amount,
          rate: actualRate,
          page: line.page,
          lineNum: line.lineNum,
          severity,
          confidence: "Medium",
          reason: rule.reason,
          recommendedAction: `Review interchange qualification. Target rate: ${rule.targetRate.toFixed(2)}%. Current spread: ${rateSpread.toFixed(2)}%`,
          targetRate: rule.targetRate,
          spread: revenueLost,
        });
        break; // first matching rule wins for this line
      }
    }
  }

  return { results, matchedIndices };
}

// ── Unknown Fee Detection ────────────────────────────────────────────────────

export function detectUnknowns(
  lines: NormalizedLine[],
  excludeIndices: Set<number>
): DetectionResult[] {
  const results: DetectionResult[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (excludeIndices.has(i)) continue;

    const line = lines[i];
    // Only flag lines with an actual dollar amount
    if (line.amount <= 0) continue;

    results.push({
      type: "unknown",
      title: "Unknown fee requires review",
      category: "Gateway",
      rawLine: line.raw,
      amount: line.amount,
      rate: line.rate,
      page: line.page,
      lineNum: line.lineNum,
      severity: "Low",
      confidence: "Low",
      reason: "Fee not classified by PCI or downgrade rule packs",
      recommendedAction: "Approve as valid pass-through or escalate for review",
    });
  }

  return results;
}

// ── Interchange Padding Detection ───────────────────────────────────────────

export function detectPadding(
  lines: NormalizedLine[],
  excludeIndices: Set<number>,
  processorName?: string,
): { results: DetectionResult[]; matchedIndices: Set<number> } {
  const results: DetectionResult[] = [];
  const matchedIndices = new Set<number>();
  const tolerance = 0.05; // 0.05% tolerance for rounding differences

  for (let i = 0; i < lines.length; i++) {
    if (excludeIndices.has(i)) continue;

    const line = lines[i];
    // Expand processor-specific category names with standard equivalents
    const matchText = expandProcessorAliases(line.raw, processorName);
    const lineTokens = tokenize(matchText);

    for (const benchmark of INTERCHANGE_BENCHMARKS) {
      if (keywordsMatch(lineTokens, benchmark.keywords)) {
        matchedIndices.add(i);

        // Extract the charged rate from the line
        // If line has a rate, use it; otherwise skip (can't detect padding without rate)
        const chargedRate = line.rate;
        if (chargedRate === 0) {
          // No rate on line - likely fee-only without percentage shown
          // For now, skip padding detection on these lines
          break;
        }

        const officialRate = benchmark.officialRate;
        const rateDelta = chargedRate - officialRate;

        // Only flag if charged rate exceeds official rate by more than tolerance
        if (rateDelta > tolerance) {
          const paddingAmount = line.amountIsVolume
            ? line.amount * rateDelta / 100
            : line.amount * rateDelta / chargedRate;

          let severity: "High" | "Medium" | "Low" = "Low";
          if (rateDelta > 0.50) severity = "High";
          else if (rateDelta > 0.25) severity = "Medium";

          results.push({
            type: "padding",
            title: `${benchmark.brand === "V" ? "Visa" : "Mastercard"} - ${benchmark.category} Padded`,
            category: "Interchange Padding",
            rawLine: line.raw,
            amount: line.amount,
            rate: chargedRate,
            page: line.page,
            lineNum: line.lineNum,
            severity,
            confidence: "High",
            reason: `Charged rate ${chargedRate.toFixed(2)}% exceeds official interchange rate ${officialRate.toFixed(2)}% by ${rateDelta.toFixed(2)}%`,
            recommendedAction: `Review with processor - official ${benchmark.category} rate is ${officialRate.toFixed(2)}% + $${benchmark.officialFee.toFixed(2)}`,
            targetRate: officialRate,
            spread: paddingAmount,
          });
        }

        break; // first matching benchmark wins for this line
      }
    }
  }

  return { results, matchedIndices };
}
