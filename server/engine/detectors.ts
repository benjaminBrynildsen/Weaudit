import type { NormalizedLine } from "./normalizer";
import type { DowngradeRule, Finding, FindingType, Company } from "../storage";
import { INTERCHANGE_BENCHMARKS, type InterchangeBenchmark } from "./benchmarks";
import { expandAbbreviations } from "./abbreviations";

// ── Non-PCI Detection ────────────────────────────────────────────────────────

const NON_PCI_PATTERNS = [
  /NON[\s-]*PCI/i,
  /PCI\s*NON[\s-]*COMPLIANCE/i,
  /NON[\s-]*COMPLIANCE\s*FEE/i,
  /PCI\s*PENALTY/i,
  /NON[\s-]*VALIDATED/i,
  /NON\s+RECEIPT.*PCI/i,
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
  needsReview?: boolean;
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
  [/VI[-\s]BUS\s+CARD\s+TR(\d+)\s+LEVEL\s+(\d+)/i, "VISA BUS T$1 LEVEL $2"],

  // Business Tier + Product patterns (NEW)
  [/VI[-\s]US\s+BUS\s+TR(\d+)\s+PRD\s+(\d+)/i, "VISA BUS T$1 PRODUCT $2"],
  [/VI[-\s]BUSINESS\s+TR(\d+)\s+PRODUCT\s+(\d+)/i, "VISA BUS T$1 PRODUCT $2"],

  // Visa Purchasing
  [/VI[-\s]PURCHASING\s+CREDIT\s+PRODUCT\s+(\d+)/i, "VISA PURCHASING PRODUCT $1"],
  [/VI[-\s]PURCHASING\s+CARD\s+PRESENT/i, "VISA PURCHASING CARD PRESENT"],
  [/VI[-\s]PURCHASING\s+CARD\s+LEVEL\s+(\d+)/i, "VISA PURCHASING LEVEL $1"],

  // Visa Corporate
  [/VI[-\s]CORP(?:ORATE)?\s+PRODUCT\s+(\d+)/i, "VISA CORP PRODUCT $1"],
  [/VI[-\s]CORPORATE\s+CARD\s+LEVEL\s+(\d+)/i, "VISA CORPORATE LEVEL $1"],
  [/VI[-\s]CORP\s+CARD\s+LEVEL\s+(\d+)/i, "VISA CORPORATE LEVEL $1"],
  [/VI[-\s]CORPORATE\s+CREDIT\s+PRODUCT\s+(\d+)/i, "VISA CORPORATE PRODUCT $1"],

  // Visa Non-Qual variations
  [/VI[-\s]NON\s+QUAL\s+CONSUMER\s+CR/i, "VI NON QUAL CONSUMER CR"],
  [/VI[-\s]NON\s+QUAL\s+BUS/i, "VISA NON QUALIFIED BUSINESS"],
  [/VI[-\s]NON\s+QUAL\s+CORP\s+CR/i, "VI NON QUAL CORP CR"],
  [/VI[-\s]NON\s+QUAL\s+PURCH\s+CR/i, "VI NON QUAL PURCH CR"],

  // Visa Standard
  [/VI[-\s]STANDARD/i, "VISA STANDARD"],

  // Visa EIRF
  [/VI[-\s]EIRF/i, "EIRF"],

  // Visa CNP (Card Not Present)
  [/VI[-\s]CPS\s+CNP\s+\(([^)]+)\)/i, "VISA CPS CARD NOT PRESENT $1"],
  [/VI[-\s]CNP\s+P(\d+)\s+/i, "VISA CARD NOT PRESENT PRODUCT $1"],
  [/VI[-\s]CNP/i, "VI CNP"],

  // Visa Regulated patterns
  [/VI[-\s]US\s+REGULATED\s+COMM/i, "VISA US REGULATED COMMERCIAL"],
  [/VI[-\s]REG\s+CONSUMER/i, "VISA REGULATED CONSUMER"],

  // Mastercard Business Levels — order matters: check II before I
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+DATA\s+RATE\s+II(?!I)/i, "MASTERCARD BUS LEVEL $1 DATA RATE 2"],
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+DATA\s+RATE\s+I(?!I)/i, "MASTERCARD BUS LEVEL $1 DATA RATE 1"],
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+DATA\s+RATE\s+2/i, "MASTERCARD BUS LEVEL $1 DATA RATE 2"],
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+DATA\s+RATE\s+1/i, "MASTERCARD BUS LEVEL $1 DATA RATE 1"],
  [/MC[-\s]BUS(?:INESS)?\s+LEVEL\s+(\d+)\s+STANDARD/i, "MC BUS LEVEL $1 STANDARD"],

  // Mastercard Corporate — check II before I
  [/MC[-\s]CORP(?:ORATE)?\s+DATA\s+RATE\s+II(?!I)\s+\(US\)\s+(BUS|CORP|PUR)/i, "MASTERCARD CORP DATA RATE 2 US $1"],
  [/MC[-\s]CORP(?:ORATE)?\s+DATA\s+RATE\s+I(?!I)\s+\(US\)\s+(BUS|CORP|PUR)/i, "MASTERCARD CORP DATA RATE 1 US $1"],
  [/MC[-\s]CORP(?:ORATE)?\s+DATA\s+RATE/i, "MC CORP DATA RATE"],
  [/MC[-\s]CORP(?:ORATE)?\s+CARD\s+STD/i, "MC CORP CARD STD"],

  // Mastercard Commercial — check II before I
  [/MC[-\s]COMML?\s+DATA\s+R(?:ATE|T)\s+II(?!I)/i, "MASTERCARD COMMERCIAL DATA RATE 2"],
  [/MC[-\s]COMML?\s+DATA\s+R(?:ATE|T)\s+I(?!I)/i, "MASTERCARD COMMERCIAL DATA RATE 1"],
  [/MC[-\s]COM\s+DATA\s+RATE\s+II(?!I)/i, "MASTERCARD COMMERCIAL DATA RATE 2"],
  [/MC[-\s]COM\s+DATA\s+RATE\s+I(?!I)/i, "MASTERCARD COMMERCIAL DATA RATE 1"],

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

/**
 * BLOCK SYSTEM DISABLED - Revert to old expansion approach
 */
function expandProcessorAliases(raw: string, processorName?: string): string {
  let expanded = expandAbbreviations(raw);

  if (!processorName) return expanded;

  const normalized = processorName.toLowerCase();

  // Check CardConnect
  if (/cardconnect|cardpointe/i.test(normalized)) {
    for (const [pattern, standard] of CARDCONNECT_ALIASES) {
      if (pattern.test(expanded)) {
        const aliased = expanded.replace(pattern, standard);
        expanded = `${expanded} ${aliased}`;
      }
    }
  }

  // Check Elavon
  if (/elavon|us\s*bank/i.test(normalized)) {
    for (const [pattern, standard] of ELAVON_ALIASES) {
      if (pattern.test(expanded)) {
        const aliased = expanded.replace(pattern, standard);
        expanded = `${expanded} ${aliased}`;
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
): { results: DetectionResult[]; matchedIndices: Set<number>; matchedRuleIds: Set<string> } {
  const results: DetectionResult[] = [];
  const matchedIndices = new Set<number>();
  const matchedRuleIds = new Set<string>();

  // Sort rules by keyword count (descending) - more specific rules first.
  // Tiebreaker: prefer rules whose keywords are rarer across the rule set
  // (e.g. "PUR" is more discriminating than "CORP", which appears in many rules).
  const activeRules = rules.filter((r) => r.enabled);
  const keywordFreq = new Map<string, number>();
  for (const r of activeRules) {
    for (const kw of r.keywords) {
      const norm = normalizeRoman(kw.toUpperCase());
      keywordFreq.set(norm, (keywordFreq.get(norm) || 0) + 1);
    }
  }
  const ruleSpecificity = (r: DowngradeRule): number =>
    r.keywords.reduce((sum, kw) => {
      const norm = normalizeRoman(kw.toUpperCase());
      return sum + 1 / (keywordFreq.get(norm) || 1);
    }, 0);
  const enabledRules = activeRules.sort((a, b) => {
    const lenDiff = b.keywords.length - a.keywords.length;
    if (lenDiff !== 0) return lenDiff;
    return ruleSpecificity(b) - ruleSpecificity(a);
  });

  // DEBUG: Log detection parameters
  console.log(`[DEBUG] detectDowngrades called:`);
  console.log(`  - Lines to scan: ${lines.length}`);
  console.log(`  - Enabled rules: ${enabledRules.length}`);
  console.log(`  - Processor: ${processorName || "unknown"}`);
  console.log(`  - Excluded indices: ${excludeIndices.size}`);

  for (let i = 0; i < lines.length; i++) {
    if (excludeIndices.has(i)) continue;

    const line = lines[i];
    const matchText = expandProcessorAliases(line.raw, processorName);
    const lineTokens = tokenize(matchText);

    for (const rule of enabledRules) {
      // Brand check: Ensure line brand matches rule brand
      const lineBrand = line.raw.match(/^(VI|MC|DS)/i)?.[1]?.toUpperCase();
      const ruleBrand = rule.brand === "V" ? "VI" : rule.brand === "M" ? "MC" : rule.brand === "D" ? "DS" : null;

      if (lineBrand && ruleBrand && lineBrand !== ruleBrand) {
        continue; // Skip this rule, brand doesn't match
      }

      if (keywordsMatch(lineTokens, rule.keywords)) {
        matchedIndices.add(i);
        matchedRuleIds.add(rule.ruleId);

        // DEBUG: Log matches
        console.log(`[DEBUG] ✅ MATCH on line ${i}: ${rule.name} (brand: ${rule.brand})`);

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

        // Line is at / below target. It's not a clear downgrade — but if
        // the line rate is strictly below the rule's typical rate, the
        // product category might still be considered a downgrade by some
        // manual auditors (e.g., Business T5 lines already at 2.25% on a
        // tax-exempt L3 statement). Emit as a review candidate so the
        // user can confirm or dismiss. Skip silently for lines already at
        // the rule's expected rate — those aren't ambiguous.
        if (rateSpread < 0.01) {
          if (
            line.amountIsVolume &&
            line.rate > 0 &&
            line.rate < rule.rate - 0.01 &&
            !rule.informational
          ) {
            const theoreticalSpread = rule.rate - rule.targetRate;
            const theoreticalRevenue = line.amount * theoreticalSpread / 100;
            results.push({
              type: "downgrade",
              title: `${rule.brand === "V" ? "Visa" : "Mastercard"} - ${rule.name}`,
              category: "Pricing Model",
              rawLine: line.raw,
              amount: line.amount,
              rate: rule.rate,
              page: line.page,
              lineNum: line.lineNum,
              severity: "Low",
              confidence: "Low",
              reason: `${rule.reason} — Needs review: statement line is already at ${line.rate.toFixed(2)}%, below the rule's typical ${rule.rate.toFixed(2)}%.`,
              recommendedAction: `Confirm whether this ${rule.name} line should be treated as a downgrade from ${rule.rate.toFixed(2)}% to ${rule.targetRate.toFixed(2)}%, or left as-is at ${line.rate.toFixed(2)}%.`,
              targetRate: rule.targetRate,
              spread: theoreticalRevenue,
              needsReview: true,
            });
          }
          break; // Don't check more rules for this line
        }

        // Skip informational rules from primary audit (STD-only categories)
        // These are still detected but excluded from primary audit results
        if (rule.informational) {
          console.log(`[DEBUG] ℹ️ Skipping informational rule ${rule.name} on line ${i}: excluded from primary audit`);
          break; // Don't check more rules for this line
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

  return { results, matchedIndices, matchedRuleIds };
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

// ── Service Charge Detection ────────────────────────────────────────────────
// Parses directly from raw PDF page text to handle multi-line entries
// (e.g. "AMEX CREDITS TRANS FEE" on line 1, "1 TRANSACTIONS AT .040000" on line 2)
// and bare decimal rates (.004200) that the normalizer can't see.

type ServiceChargeCategory =
  | "discount"
  | "transaction"
  | "amex_discount"
  | "amex_transaction"
  | "statement"
  | "avs"
  | "reg"
  | "chargeback"
  | "auth";

function classifyServiceChargeLine(raw: string): ServiceChargeCategory | null {
  const upper = raw.toUpperCase();

  if (/STATEMENT\s+FEE/i.test(upper)) return "statement";
  if (/AVS/i.test(upper)) return "avs";
  if (/\b(REG|REGULATORY)\b/i.test(upper)) return "reg";
  if (/\b(CHARGEBACK|CHG\s*BK)\b/i.test(upper)) return "chargeback";

  // AMEX-specific before generic
  if (/AMEX/i.test(upper) && /SALES\s+DISCOUNT/i.test(upper)) return "amex_discount";
  if (/AMEX/i.test(upper) && /TRANS(ACTION)?\s+FEE/i.test(upper)) return "amex_transaction";

  // Generic
  if (/SALES\s+DISCOUNT/i.test(upper)) return "discount";
  if (/TRANS(ACTION)?\s+FEE/i.test(upper)) return "transaction";

  if (/\bAUTH\b/i.test(upper)) return "auth";

  return null;
}

function getContractedRate(category: ServiceChargeCategory, company: Company): number {
  switch (category) {
    case "discount":       return company.discountRate;
    case "transaction":    return company.transactionFee;
    case "amex_discount":  return company.discountRate;
    case "amex_transaction": return company.amexFee;
    case "statement":      return company.statementFee;
    case "avs":            return company.avsFee;
    case "reg":            return company.regFee;
    case "chargeback":     return company.chargebackFee;
    case "auth":           return company.authFee;
  }
}

function parseServiceChargeRate(raw: string): { rate: number; isPerTransaction: boolean; txCount?: number; volume?: number } | null {
  // Pattern 1: Discount/volume rate — ".004200 DISC RATE TIMES $29,286.21"
  // The rate in Fiserv statements always has a dot (.004200 or 0.004200)
  const discountMatch = raw.match(/(\d*\.\d+)\s+DISC\s+RATE\s+TIMES\s+\$([\d,]+\.?\d*)/i);
  if (discountMatch) {
    const rate = parseFloat(discountMatch[1]);
    const volume = parseFloat(discountMatch[2].replace(/,/g, ""));
    return { rate, isPerTransaction: false, volume };
  }

  // Pattern 1b: Discount rate without TIMES (just DISC RATE)
  const discountMatch2 = raw.match(/(\d*\.\d+)\s+DISC\s+RATE/i);
  if (discountMatch2) {
    const rate = parseFloat(discountMatch2[1]);
    return { rate, isPerTransaction: false };
  }

  // Pattern 2: Per-transaction — "N TRANSACTIONS AT .040000"
  const transMatch = raw.match(/(\d+)\s+TRANSACTIONS?\s+AT\s+(\d*\.\d+)/i);
  if (transMatch) {
    const txCount = parseInt(transMatch[1], 10);
    const perTxRate = parseFloat(transMatch[2]);
    return { rate: perTxRate, isPerTransaction: true, txCount };
  }

  // Pattern 3: Flat fee for statement/chargeback/AVS/etc.
  if (/STATEMENT\s+FEE|CHARGEBACK|CHG\s*BK|AVS|REG|REGULATORY|AUTH/i.test(raw)) {
    const amountMatch = raw.match(/\$?([\d,]+\.?\d*)\s*$/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      return { rate: amount, isPerTransaction: true };
    }
  }

  return null;
}

const CATEGORY_LABELS: Record<ServiceChargeCategory, string> = {
  discount: "Sales Discount Rate",
  transaction: "Transaction Fee",
  amex_discount: "AMEX Discount Rate",
  amex_transaction: "AMEX Transaction Fee",
  statement: "Statement Fee",
  avs: "AVS Fee",
  reg: "Regulatory Fee",
  chargeback: "Chargeback Fee",
  auth: "Auth Fee",
};

/**
 * Detect service charges by scanning raw page text directly.
 * Bypasses the NormalizedLine pipeline because:
 * - Multi-line entries (description + "N TRANSACTIONS AT .040000") span 2 lines
 * - Bare decimal rates like .004200 aren't recognized by the normalizer
 * - The normalizer drops lines without $ amounts or % rates
 */
export function detectServiceChargesFromText(
  pages: { pageNum: number; text: string }[],
  company: Company | undefined,
): DetectionResult[] {
  const results: DetectionResult[] = [];

  console.log(`[DEBUG] detectServiceChargesFromText called:`);
  console.log(`  - Pages: ${pages.length}`);
  console.log(`  - Company: ${company?.name || "not found"}`);

  // Section end patterns — stop scanning when we hit one of these
  const SECTION_END = /^(INTERCHANGE|PENDING\s+INTERCHANGE|ASSESSMENT|DUES|GRAND\s+TOTAL|TOTAL\s+CHARGES|ADJUSTMENTS|TOTAL\s+\(SERVICE)/i;

  for (const page of pages) {
    const textLines = page.text.split("\n");
    let inSection = false;

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i].trim();

      // Detect section start
      if (/^SERVICE\s+CHARGES?/i.test(line)) {
        inSection = true;
        continue;
      }

      if (!inSection) continue;

      // Detect section end
      if (SECTION_END.test(line)) {
        inSection = false;
        break;
      }

      // Skip empty lines, dates, repeated headers
      if (!line) continue;
      if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(line)) continue;
      if (/^SERVICE\s+CHARGES?$/i.test(line)) continue;

      // Check if next line is a rate continuation ("N TRANSACTIONS AT .040000")
      const nextLine = (i + 1 < textLines.length) ? textLines[i + 1].trim() : "";
      const isNextRate = /^\d+\s+TRANSACTIONS?\s+AT\s+/i.test(nextLine);

      let combined = line;
      if (isNextRate) {
        combined = `${line} ${nextLine}`;
        i++; // consume the next line
      }

      // Classify the combined line
      const category = classifyServiceChargeLine(combined);
      if (!category) continue;

      // Parse the rate
      const parsed = parseServiceChargeRate(combined);
      if (!parsed) continue;

      const chargedRate = parsed.rate;
      const lineNum = i + 1;

      // Compute the dollar amount of this charge
      let chargeAmount = 0;
      if (parsed.isPerTransaction && parsed.txCount) {
        chargeAmount = parsed.txCount * chargedRate;
      } else if (!parsed.isPerTransaction && parsed.volume) {
        chargeAmount = parsed.volume * chargedRate;
      }

      if (!company) {
        results.push({
          type: "service_charge",
          title: CATEGORY_LABELS[category],
          category: "Service Charges",
          rawLine: combined,
          amount: chargeAmount,
          rate: chargedRate,
          page: page.pageNum,
          lineNum,
          severity: "Low",
          confidence: "Low",
          reason: `No company on file to compare rates.`,
          recommendedAction: "Add company to the system to enable rate comparison.",
          targetRate: 0,
          spread: 0,
        });
        continue;
      }

      const contracted = getContractedRate(category, company);
      const delta = chargedRate - contracted;

      let severity: "High" | "Medium" | "Low" = "Low";
      if (parsed.isPerTransaction) {
        if (delta > 0.10) severity = "High";
        else if (delta > 0.02) severity = "Medium";
      } else {
        // Raw decimal rates — .004200 vs .0005
        if (delta > 0.003) severity = "High";
        else if (delta > 0.001) severity = "Medium";
      }

      const isOvercharged = delta > 0.0001;
      const isMatch = !isOvercharged;

      // Format for display
      const fmtRate = parsed.isPerTransaction
        ? `$${chargedRate.toFixed(4)}`
        : `${(chargedRate * 100).toFixed(4)}%`;
      const fmtContracted = parsed.isPerTransaction
        ? `$${contracted.toFixed(4)}`
        : `${(contracted * 100).toFixed(4)}%`;

      results.push({
        type: "service_charge",
        title: `${CATEGORY_LABELS[category]}${isOvercharged ? " - Overcharge" : ""}`,
        category: "Service Charges",
        rawLine: combined,
        amount: chargeAmount,
        rate: chargedRate,
        page: page.pageNum,
        lineNum,
        severity: isMatch ? "Low" : severity,
        confidence: "High",
        reason: isMatch
          ? `Rate matches contract. Charged: ${fmtRate}, Contracted: ${fmtContracted}`
          : `Overcharge detected. Charged: ${fmtRate}, Contracted: ${fmtContracted}`,
        recommendedAction: isMatch
          ? "No action needed — rate matches contracted terms."
          : `Request rate adjustment to contracted rate of ${fmtContracted}.`,
        targetRate: contracted,
        spread: isOvercharged ? Math.abs(delta) : 0,
      });
    }
  }

  console.log(`[DEBUG] Service charge results: ${results.length} findings`);
  return results;
}
