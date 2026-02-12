import { parsePdf } from "./parser";
import { normalizePages, extractFields } from "./normalizer";
import { detectNonPci, detectDowngrades, detectPadding, detectUnknowns } from "./detectors";
import { scoreAndPrioritize } from "./scorer";
import { storage } from "../storage";
import type { Finding } from "../storage";
import { detectInterchangeSection, filterInterchangeLines } from "./section-detector";
import { StatementParserFactory } from "./parsers/parser-factory";

export async function runAuditScan(auditId: string): Promise<void> {
  // Update status to scanning
  await storage.updateAudit(auditId, { status: "scanning" });

  try {
    // Get the statement(s) for this audit
    const statements = await storage.getStatementsByAudit(auditId);
    if (statements.length === 0) {
      await storage.updateAudit(auditId, { status: "idle" });
      return;
    }

    const statement = statements[0]; // primary statement

    // Step 0: Clear any existing findings/unknowns from a previous scan
    await storage.deleteFindingsByAudit(auditId);
    await storage.deleteUnknownFeesByAudit(auditId);

    // Step 1: Parse PDF
    let pages;
    let fullText = "";
    if (statement.fileType === "pdf") {
      const parseResult = await parsePdf(statement.filePath);
      pages = parseResult.pages;
      fullText = parseResult.fullText;
    } else {
      // CSV: treat as single page
      const fs = await import("fs");
      fullText = fs.readFileSync(statement.filePath, "utf-8");
      pages = [{ pageNum: 1, text: fullText }];
    }

    // Store raw text on statement
    await storage.createStatement({
      ...statement,
      rawText: fullText.slice(0, 50000), // cap at 50KB
    }).catch(() => {}); // update if possible

    // Step 2 & 3: Use processor-specific parser
    // First pass: detect processor with generic parser
    const genericParser = StatementParserFactory.createParser(undefined);
    const fields = genericParser.extractFields(pages);
    const processorName = fields.processorDetected || "";

    // Second pass: use processor-specific parser if available
    const parser = StatementParserFactory.createParser(processorName);
    const normalizedLines = parser.normalizePages(pages);

    // Re-extract fields with processor-specific parser (may differ for Fiserv Type 2, etc.)
    const finalFields = parser.extractFields(pages);

    // Compute adjusted volume/fees (subtract AMEX per training docs)
    const adjustedVolume = (finalFields.totalVolume || 0) - (finalFields.amexVolume || 0);
    const adjustedFees = (finalFields.totalFees || 0) - (finalFields.amexFees || 0);
    const effectiveRate = adjustedVolume > 0 ? adjustedFees / adjustedVolume : finalFields.effectiveRate;

    await storage.updateAudit(auditId, {
      dba: finalFields.dba,
      mid: finalFields.mid || undefined,
      statementPeriod: finalFields.statementPeriod,
      totalVolume: finalFields.totalVolume,
      totalFees: finalFields.totalFees,
      amexVolume: finalFields.amexVolume,
      amexFees: finalFields.amexFees,
      effectiveRate,
      processorDetected: processorName,
    });

    // Step 3.5: No-data detection — if no lines extracted and no volume/fees found
    if (normalizedLines.length === 0 && !finalFields.totalVolume && !finalFields.totalFees) {
      await storage.createNotice({
        auditId,
        type: "no_data",
        amount: 0,
        message: "Statement parsed but no transaction volume or fees were detected. This may be a zero-activity month.",
      });
      await storage.updateAudit(auditId, {
        status: "complete",
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // Step 4: Detect Interchange Section
    // Only scan the "Pending Interchange Charges" or equivalent section for downgrades
    const interchangeSection = detectInterchangeSection(normalizedLines, fullText);
    const interchangeLines = filterInterchangeLines(normalizedLines, interchangeSection);

    console.log(`[Audit ${auditId}] Interchange section: ${interchangeSection?.sectionName || "not detected"}`);
    console.log(`[Audit ${auditId}] Scanning ${interchangeLines.length} lines in interchange section (of ${normalizedLines.length} total)`);

    // Step 5: Detect Non-PCI
    const { results: nonPciResults, matchedIndices: nonPciIndices } = detectNonPci(normalizedLines);

    // Step 6: Detect Downgrades (ONLY in interchange section)
    // Read gateway level from audit to filter rules
    const audit = await storage.getAudit(auditId);
    const gatewayLevel = audit?.gatewayLevel;

    let downgradeRules = await storage.listDowngradeRules();
    // Filter rules by gateway level: Level II clients only see L2 rules,
    // Level III clients see L3 rules (which include all L2 keywords plus L3-only)
    if (gatewayLevel) {
      downgradeRules = downgradeRules.filter((r) =>
        r.levelTags.includes(gatewayLevel)
      );
    }

    const { results: downgradeResults, matchedIndices: downgradeIndices } = detectDowngrades(
      interchangeLines,  // Only scan interchange section, not all lines
      downgradeRules,
      nonPciIndices,
      processorName,
    );

    // Step 7: Detect Padding (DISABLED - needs accurate benchmark data)
    // TODO: Re-enable after getting official Visa/MC interchange tables for reseller scenarios
    // const excludePaddingIndices = new Set(Array.from(nonPciIndices).concat(Array.from(downgradeIndices)));
    // const { results: paddingResults, matchedIndices: paddingIndices } = detectPadding(
    //   normalizedLines,
    //   excludePaddingIndices,
    //   processorName,
    // );
    const paddingResults: typeof nonPciResults = [];
    const paddingIndices = new Set<number>();

    // Step 8: Detect Unknowns (ONLY in interchange section to reduce noise)
    const allMatched = new Set(
      Array.from(nonPciIndices)
        .concat(Array.from(downgradeIndices))
        .concat(Array.from(paddingIndices))
    );
    const unknownResults = detectUnknowns(interchangeLines, allMatched);

    // Step 9: Deduplicate downgrades — same interchange category often
    // appears in both the fee-line section and the interchange summary grid.
    // Keep the entry with the highest amount (the grid line has volume).
    const dedupedDowngrades: typeof downgradeResults = [];
    const dgMap = new Map<string, (typeof downgradeResults)[0]>();
    for (const d of downgradeResults) {
      const existing = dgMap.get(d.title);
      if (!existing || d.amount > existing.amount) {
        dgMap.set(d.title, d);
      }
    }
    dedupedDowngrades.push(...Array.from(dgMap.values()));

    // Step 10: Score & Prioritize
    const allDetections = [...nonPciResults, ...dedupedDowngrades, ...paddingResults, ...unknownResults];
    const prioritized = scoreAndPrioritize(allDetections);

    // Step 11: Save findings
    for (let i = 0; i < prioritized.length; i++) {
      const det = prioritized[i];
      const finding = await storage.createFinding({
        auditId,
        type: det.type,
        title: det.title,
        category: det.category,
        rawLine: det.rawLine,
        amount: det.amount,
        rate: det.rate,
        page: det.page,
        lineNum: det.lineNum,
        severity: det.severity,
        confidence: det.confidence,
        status: "open",
        reason: det.reason,
        recommendedAction: det.recommendedAction,
        targetRate: det.targetRate,
        spread: det.spread,
        priority: i + 1,
      });

      // Create unknown fee record for admin review queue
      if (det.type === "unknown") {
        await storage.createUnknownFee({
          findingId: finding.findingId,
          auditId,
          rawLine: det.rawLine,
          amount: det.amount,
          approvalStatus: "pending",
        });
      }
    }

    // Step 12: Post-scan checks — create notices for processor-specific issues

    // Worldpay: Flag RISK FEES
    if (/worldpay/i.test(processorName) && /RISK\s+FEES/i.test(fullText)) {
      await storage.createNotice({
        auditId,
        type: "risk_fees",
        amount: 0,
        message: "RISK FEES detected on Worldpay statement. This should be noted in the audit tracker under Red Flags/Notes.",
      });
    }

    // AMEX Direct vs Opt Blue detection
    if (finalFields.amexVolume && finalFields.amexVolume > 0) {
      const amexFees = finalFields.amexFees || 0;
      const amexFeeRatio = amexFees / finalFields.amexVolume;

      if (amexFeeRatio < 0.001) {
        // Very low/zero fees relative to AMEX volume → likely AMEX Direct
        await storage.createNotice({
          auditId,
          type: "amex_direct",
          amount: 0,
          message: "AMEX appears to be on Direct program (minimal processor-collected fees). Any interchange fees on AMEX transactions beyond a transaction fee may indicate overbilling.",
        });
      } else {
        // Has AMEX interchange fees → Opt Blue
        // Flag if monthly volume suggests annual could exceed $1M
        if (finalFields.amexVolume > 83333) {
          await storage.createNotice({
            auditId,
            type: "amex_opt_blue_threshold",
            amount: 0,
            message: `AMEX Opt Blue detected with monthly volume of $${finalFields.amexVolume.toLocaleString()}. If annual AMEX volume exceeds $1M, watch for continuation fee (0.03% on sales over $3M rolling 12 months).`,
          });
        }
      }
    }

    // Chase: Check discount rate consistency across card types
    if (/chase/i.test(processorName)) {
      const cardTypeRates = new Map<string, number>();
      const lines = fullText.split("\n");
      for (const line of lines) {
        const cardTypeMatch = line.match(/^(VISA|MASTERCARD|MC|DISCOVER)\b/i);
        const rateMatch = line.match(/(\d+\.?\d*)\s*%/);
        if (cardTypeMatch && rateMatch) {
          const cardType = cardTypeMatch[1].toUpperCase();
          const rate = parseFloat(rateMatch[1]);
          if (rate > 0 && rate < 10) {
            cardTypeRates.set(cardType, rate);
          }
        }
      }
      if (cardTypeRates.size > 1) {
        const rates = Array.from(cardTypeRates.values());
        const uniqueRates = new Set(rates.map((r) => r.toFixed(4)));
        if (uniqueRates.size > 1) {
          const rateList = Array.from(cardTypeRates.entries())
            .map(([type, rate]) => `${type}: ${rate}%`)
            .join(", ");
          await storage.createNotice({
            auditId,
            type: "chase_rate_mismatch",
            amount: 0,
            message: `Chase statement shows different discount rates across card types (${rateList}). All card types should show the same discount rate per the pricing agreement.`,
          });
        }
      }
    }

    // Finalize
    const hasUnknowns = unknownResults.length > 0;
    await storage.updateAudit(auditId, {
      status: hasUnknowns ? "needs_review" : "complete",
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Scan failed for audit ${auditId}:`, error);
    await storage.updateAudit(auditId, { status: "idle" });
    throw error;
  }
}
