#!/usr/bin/env tsx
/**
 * Test script for auditing PATRIOT FLOORING PDF statement
 */

import { storage } from "./server/storage";
import { runAuditScan } from "./server/engine/runner";
import { setupTables } from "./server/db/setup";
import path from "path";
import fs from "fs";

async function testAudit() {
  console.log("🔧 Setting up tables...");
  try {
    await setupTables();
  } catch (e) {
    console.log("Tables already exist (OK)");
  }

  console.log("\n📄 Creating test audit...");
  const pdfPath = path.resolve("attached_assets/PATRIOT_FLOORING_SUPPLIES_-_737191920880_December_LOCATION_1769807366701.pdf");

  if (!fs.existsSync(pdfPath)) {
    console.error("❌ PDF not found:", pdfPath);
    process.exit(1);
  }

  // Create audit
  const audit = await storage.createAudit({
    clientName: "PATRIOT FLOORING SUPPLIES",
    processor: "Unknown",
    statementMonth: "December 2024",
    mid: "737191920880",
    status: "idle",
    gatewayLevel: "II", // Assume Level II for testing
  });

  console.log("✅ Audit created:", audit.auditId);

  // Create statement record
  const statement = await storage.createStatement({
    auditId: audit.auditId,
    fileName: "PATRIOT_FLOORING_December.pdf",
    filePath: pdfPath,
    fileType: "pdf",
    fileSize: fs.statSync(pdfPath).size,
  });

  console.log("✅ Statement created:", statement.statementId);

  console.log("\n🔍 Running audit scan...");
  try {
    await runAuditScan(audit.auditId);
    console.log("✅ Scan completed!");
  } catch (error) {
    console.error("❌ Scan failed:", error);
    process.exit(1);
  }

  // Fetch results
  console.log("\n📊 Fetching results...");
  const updatedAudit = await storage.getAudit(audit.auditId);
  const findings = await storage.getFindingsByAudit(audit.auditId);
  const notices = await storage.getNoticesByAudit(audit.auditId);

  console.log("\n" + "=".repeat(80));
  console.log("AUDIT RESULTS");
  console.log("=".repeat(80));

  console.log("\n📋 EXTRACTED FIELDS:");
  console.log("  Processor Detected:", updatedAudit?.processorDetected || "Unknown");
  console.log("  DBA:", updatedAudit?.dba || "Not found");
  console.log("  MID:", updatedAudit?.mid || "Not found");
  console.log("  Statement Period:", updatedAudit?.statementPeriod || "Not found");
  console.log("  Total Volume:", updatedAudit?.totalVolume ? `$${updatedAudit.totalVolume.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Not found");
  console.log("  Total Fees:", updatedAudit?.totalFees ? `$${updatedAudit.totalFees.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Not found");
  console.log("  AMEX Volume:", updatedAudit?.amexVolume ? `$${updatedAudit.amexVolume.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "$0.00");
  console.log("  AMEX Fees:", updatedAudit?.amexFees ? `$${updatedAudit.amexFees.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "$0.00");
  console.log("  Effective Rate:", updatedAudit?.effectiveRate ? `${(updatedAudit.effectiveRate * 100).toFixed(4)}%` : "Not calculated");
  console.log("  Status:", updatedAudit?.status);

  console.log("\n🔍 FINDINGS:", findings.length);

  if (findings.length > 0) {
    const byType = {
      non_pci: findings.filter(f => f.type === "non_pci"),
      downgrade: findings.filter(f => f.type === "downgrade"),
      padding: findings.filter(f => f.type === "padding"),
      unknown: findings.filter(f => f.type === "unknown"),
    };

    console.log(`  • Non-PCI Fees: ${byType.non_pci.length}`);
    console.log(`  • Downgrades: ${byType.downgrade.length}`);
    console.log(`  • Padding: ${byType.padding.length}`);
    console.log(`  • Unknown Fees: ${byType.unknown.length}`);

    // Show padding findings first if any
    if (byType.padding.length > 0) {
      console.log("\n🚨 PADDING DETECTED:");
      byType.padding.slice(0, 5).forEach((f, i) => {
        console.log(`\n  ${i + 1}. [${f.severity}] ${f.title}`);
        console.log(`     Amount: $${f.amount.toFixed(2)} | Charged Rate: ${f.rate.toFixed(2)}% | Official Rate: ${f.targetRate?.toFixed(2)}%`);
        console.log(`     Page ${f.page}, Line ${f.lineNum}`);
        console.log(`     Raw: ${f.rawLine.slice(0, 80)}${f.rawLine.length > 80 ? '...' : ''}`);
        if (f.spread) {
          console.log(`     Padding Amount: $${f.spread.toFixed(2)}`);
        }
        console.log(`     ${f.reason}`);
      });
    }

    // Show first 10 findings
    console.log("\n📝 TOP FINDINGS (by priority):");
    findings.slice(0, 10).forEach((f, i) => {
      console.log(`\n  ${i + 1}. [${f.severity}] ${f.title}`);
      console.log(`     Type: ${f.type} | Amount: $${f.amount.toFixed(2)} | Rate: ${f.rate.toFixed(2)}%`);
      console.log(`     Page ${f.page}, Line ${f.lineNum}`);
      console.log(`     Raw: ${f.rawLine.slice(0, 80)}${f.rawLine.length > 80 ? '...' : ''}`);
      if (f.spread) {
        console.log(`     Revenue Lost: $${f.spread.toFixed(2)}`);
      }
      console.log(`     Reason: ${f.reason}`);
    });

    if (findings.length > 10) {
      console.log(`\n  ... and ${findings.length - 10} more findings`);
    }

    // Calculate totals
    const totalRevenueLost = findings.reduce((sum, f) => sum + (f.spread || 0), 0);
    const discountSavings = totalRevenueLost * 0.42;

    console.log("\n💰 SAVINGS POTENTIAL:");
    console.log(`  Revenue Lost: $${totalRevenueLost.toFixed(2)}`);
    console.log(`  Discount Savings (42%): $${discountSavings.toFixed(2)}`);
  }

  if (notices.length > 0) {
    console.log("\n⚠️  NOTICES:", notices.length);
    notices.forEach((n, i) => {
      console.log(`  ${i + 1}. [${n.type}] ${n.message}`);
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ Test completed successfully!");
  console.log("=".repeat(80));

  process.exit(0);
}

testAudit().catch(error => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
