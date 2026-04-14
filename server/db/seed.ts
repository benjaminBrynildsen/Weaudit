/**
 * Seeds the default processor ISOs and downgrade rules.
 *
 * Backend-agnostic: uses the `storage` abstraction, so it works against
 * whichever backend is active (DynamoDB locally, Postgres on Render).
 *
 * Idempotent: if rows already exist in a target table, that table is
 * skipped. That means safe to run on every deploy — it will populate an
 * empty database once, then never touch it again. Any edits you make
 * through the UI survive subsequent runs.
 *
 * Run directly: npx tsx server/db/seed.ts
 */

import { storage, getBackend } from "../storage";

const isos = [
  { name: "Fiserv", aliases: ["First Data"] },
  { name: "CardConnect", aliases: ["CardPointe"] },
  { name: "North Summit", aliases: ["NS"] },
  { name: "CoCard", aliases: ["Co Card"] },
  { name: "Cardone", aliases: ["Card One"] },
  { name: "Bank of America", aliases: ["BOA", "BofA"] },
  { name: "Wells Fargo", aliases: ["WF"] },
  { name: "VersaPay", aliases: ["Versa Pay"] },
  { name: "Solupay", aliases: ["Solu Pay"] },
  { name: "PNC / KeyBank", aliases: ["PNC", "KeyBank"] },
];

type RuleSeed = {
  brand: "V" | "M";
  name: string;
  rate: number;
  reason: string;
  targetRate: number;
  levelTags: string[];
  keywords: string[];
  informational?: boolean;
};

// ── Data Level II Downgrades ─────────────────────────────────────────────────
const l2Rules: RuleSeed[] = [
  // Visa L2
  { brand: "V", name: "EIRF NON CPS ALL OTHER", rate: 2.30, reason: "Missing Zip Code and or Street Number - Could have cleared at V-CPS/Card Not Present Credit", targetRate: 1.80, levelTags: ["II"], keywords: ["EIRF", "NON CPS", "ALL OTHER"] },
  { brand: "V", name: "EIRF NON CPS ALL OTHER (DB)", rate: 1.75, reason: "Missing Zip Code and or Street Number - Could have cleared at V-CPS/Card Not Present Debit", targetRate: 1.65, levelTags: ["II"], keywords: ["EIRF", "DB", "NON CPS"] },
  { brand: "V", name: "Standard", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.05, levelTags: ["II"], keywords: ["STANDARD"] },
  { brand: "V", name: "Non-Qual Corp Credit", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["II"], keywords: ["NON QUAL", "CORP", "CR"] },
  { brand: "V", name: "Non-Qual CRP Data", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["II"], keywords: ["NON QUAL", "CRP", "DATA"] },
  { brand: "V", name: "Non-Qual Purch Credit", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["II"], keywords: ["NON QUAL", "PURCH", "CR"] },
  { brand: "V", name: "Non-Qual Purch Data", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["II"], keywords: ["NON QUAL", "PURCH", "DATA"] },
  { brand: "V", name: "Non-Qual Business Credit", rate: 3.15, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.10, levelTags: ["II"], keywords: ["NON QUAL", "BUS", "CR"] },
  { brand: "V", name: "Non-Qual Consumer Data", rate: 2.70, reason: "Delayed Settlement on Consumer Credit Transaction or Missing several data fields", targetRate: 2.40, levelTags: ["II"], keywords: ["NON QUAL", "CONSUMER", "DATA"] },
  { brand: "V", name: "Non-Qual Consumer Credit", rate: 3.15, reason: "Delayed Settlement on Consumer Credit Transaction or Missing several data fields", targetRate: 2.40, levelTags: ["II"], keywords: ["NON QUAL", "CONSUMER", "CR"] },
  { brand: "V", name: "Business Standard", rate: 2.95, reason: "Delayed Settlement - Could have cleared at Level II (Unless Tax Exempt) OR Missing Multiple Data Fields", targetRate: 2.05, levelTags: ["II"], keywords: ["BUS", "STANDARD"] },
  { brand: "V", name: "Business T1 Product 1", rate: 2.65, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 1.90, levelTags: ["II"], keywords: ["BUS", "T1", "PRODUCT 1"] },
  { brand: "V", name: "Business T2 Product 1", rate: 2.80, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.05, levelTags: ["II"], keywords: ["BUS", "T2", "PRODUCT 1"] },
  { brand: "V", name: "Business T3 Product 1", rate: 2.85, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.10, levelTags: ["II"], keywords: ["BUS", "T3", "PRODUCT 1"] },
  { brand: "V", name: "Business T4 Product 1", rate: 2.95, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.20, levelTags: ["II"], keywords: ["BUS", "T4", "PRODUCT 1"] },
  { brand: "V", name: "Business T5 Product 1", rate: 3.00, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.25, levelTags: ["II"], keywords: ["BUS", "T5", "PRODUCT 1"] },
  { brand: "V", name: "CORPORATE Product 1", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.05, levelTags: ["II"], keywords: ["CORP", "PRODUCT 1"] },
  { brand: "V", name: "PURCHASING Product 1", rate: 2.70, reason: "Missing Level II Information - Could have cleared at Level II", targetRate: 2.50, levelTags: ["II"], keywords: ["PURCHASING", "PRODUCT 1"] },
  { brand: "V", name: "PURCHASING CARD PRESENT", rate: 2.50, reason: "Missing billing address/zip code/invoice number/sales tax Information - Could have cleared at Level III (Unless Tax Exempt)", targetRate: 1.85, levelTags: ["II"], keywords: ["PURCHASING", "CARD PRESENT"] },
  // Mastercard L2
  { brand: "M", name: "BUSINESS CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth/Missing Mult Data Fields - Could have cleared at Data II Business", targetRate: 1.80, levelTags: ["II"], keywords: ["BUS", "CARD", "STD"], informational: true },
  { brand: "M", name: "CORPORATE CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth/Missing Mult Data Fields - Could have cleared at Data II Corporate", targetRate: 1.90, levelTags: ["II"], keywords: ["CORP", "CARD", "STD"], informational: true },
  { brand: "M", name: "PURCHASING CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth/Missing Mult Data Fields - Could have cleared at Data II Purchasing", targetRate: 1.90, levelTags: ["II"], keywords: ["PUR", "CARD", "STD"], informational: true },
  { brand: "M", name: "FLEET CARD STD", rate: 3.15, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 1.90, levelTags: ["II"], keywords: ["FLEET", "STD"], informational: true },
  { brand: "M", name: "HIGH VALUE STD", rate: 3.15, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 1.90, levelTags: ["II"], keywords: ["HIGH VALUE", "STD"], informational: true },
  { brand: "M", name: "CORP DATA RATE I (US) BUS", rate: 2.65, reason: "Missing Multiple Data Fields or Tax Exempt Transaction", targetRate: 1.90, levelTags: ["II"], keywords: ["DATA RATE 1", "CORP", "BUS"] },
  { brand: "M", name: "CORP DATA RATE I (US) CORP", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 2.10, levelTags: ["II"], keywords: ["DATA RATE 1", "CORP"] },
  { brand: "M", name: "CORP DATA RATE (1) PUR", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 2.50, levelTags: ["II"], keywords: ["DATA RATE 1", "PUR"] },
  { brand: "M", name: "COM DATA RATE 1 FLT NFUEL", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 2.50, levelTags: ["II"], keywords: ["DATA RATE 1", "FLT", "NFUEL"] },
  { brand: "M", name: "LARGE MARKET DATA RATE I", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 2.50, levelTags: ["II"], keywords: ["LARGE MARKET", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 1 DATA RATE 1", rate: 2.65, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level I Merchant", targetRate: 1.90, levelTags: ["II"], keywords: ["BUS", "LEVEL 1", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 2 DATA RATE 1", rate: 2.80, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 2 Merchant", targetRate: 2.05, levelTags: ["II"], keywords: ["BUS", "LEVEL 2", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 3 DATA RATE 1", rate: 2.85, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 3 Merchant", targetRate: 2.10, levelTags: ["II"], keywords: ["BUS", "LEVEL 3", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 4 DATA RATE 1", rate: 2.95, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 4 Merchant", targetRate: 2.20, levelTags: ["II"], keywords: ["BUS", "LEVEL 4", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 5 DATA RATE 1", rate: 3.00, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 5 Merchant", targetRate: 2.25, levelTags: ["II"], keywords: ["BUS", "LEVEL 5", "DATA RATE 1"] },
  { brand: "M", name: "BUSINESS LEVEL 2 STANDARD", rate: 3.10, reason: "Delayed Settlement/Forced Auth - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.05, levelTags: ["II"], keywords: ["BUS", "LEVEL 2", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 3 STANDARD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.10, levelTags: ["II"], keywords: ["BUS", "LEVEL 3", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 4 STANDARD", rate: 3.25, reason: "Delayed Settlement/Forced Auth - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.20, levelTags: ["II"], keywords: ["BUS", "LEVEL 4", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 5 STANDARD", rate: 3.30, reason: "Delayed Settlement/Forced Auth - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.25, levelTags: ["II"], keywords: ["BUS", "LEVEL 5", "STANDARD"] },
];

// ── Data Level III Downgrades ────────────────────────────────────────────────
const l3Rules: RuleSeed[] = [
  // Visa L3
  { brand: "V", name: "EIRF NON CPS ALL OTHER", rate: 2.30, reason: "Missing Zip Code and or Street Number - Could have cleared at V-CPS/Card Not Present Credit", targetRate: 1.80, levelTags: ["III"], keywords: ["EIRF", "NON CPS", "ALL OTHER"] },
  { brand: "V", name: "EIRF NON CPS ALL OTHER (DB)", rate: 1.75, reason: "Missing Zip Code and or Street Number - Could have cleared at V-CPS/Card Not Present Debit", targetRate: 1.65, levelTags: ["III"], keywords: ["EIRF", "DB", "NON CPS"] },
  { brand: "V", name: "Standard", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.05, levelTags: ["III"], keywords: ["STANDARD"] },
  { brand: "V", name: "Non-Qual Corp Credit", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["III"], keywords: ["NON QUAL", "CORP", "CR"] },
  { brand: "V", name: "Non-Qual CRP Data", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 1.90, levelTags: ["III"], keywords: ["NON QUAL", "CRP", "DATA"] },
  { brand: "V", name: "Non-Qual Purch Credit", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.50, levelTags: ["III"], keywords: ["NON QUAL", "PURCH", "CR"] },
  { brand: "V", name: "Non-Qual Purch Data", rate: 2.95, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 1.90, levelTags: ["III"], keywords: ["NON QUAL", "PURCH", "DATA"] },
  { brand: "V", name: "Non-Qual Business Credit", rate: 3.15, reason: "Delayed Settlement or Missing Multiple Data Fields", targetRate: 2.10, levelTags: ["III"], keywords: ["NON QUAL", "BUS", "CR"] },
  { brand: "V", name: "Non-Qual Consumer Data", rate: 2.70, reason: "Delayed Settlement on Consumer Credit Transaction or Missing several data fields", targetRate: 2.40, levelTags: ["III"], keywords: ["NON QUAL", "CONSUMER", "DATA"] },
  { brand: "V", name: "Non-Qual Consumer Credit", rate: 3.15, reason: "Delayed Settlement on Consumer Credit Transaction or Missing several data fields", targetRate: 2.40, levelTags: ["III"], keywords: ["NON QUAL", "CONSUMER", "CR"] },
  { brand: "V", name: "Business T1 Product 1", rate: 2.65, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 1.90, levelTags: ["III"], keywords: ["BUS", "T1", "PRODUCT 1"] },
  { brand: "V", name: "Business T2 Product 1", rate: 2.80, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.05, levelTags: ["III"], keywords: ["BUS", "T2", "PRODUCT 1"] },
  { brand: "V", name: "Business T3 Product 1", rate: 2.85, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.10, levelTags: ["III"], keywords: ["BUS", "T3", "PRODUCT 1"] },
  { brand: "V", name: "Business T4 Product 1", rate: 2.95, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.20, levelTags: ["III"], keywords: ["BUS", "T4", "PRODUCT 1"] },
  { brand: "V", name: "Business T5 Product 1", rate: 3.00, reason: "Tax Exempt Transaction or Missing Level II Information - CNP Transaction", targetRate: 2.25, levelTags: ["III"], keywords: ["BUS", "T5", "PRODUCT 1"] },
  { brand: "V", name: "CORPORATE Product 1", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information - Could have cleared at Level II (Unless Tax Exempt)", targetRate: 2.05, levelTags: ["III"], keywords: ["CORP", "PRODUCT 1"] },
  { brand: "V", name: "PURCHASING Product 1", rate: 2.70, reason: "Missing Level III Information - Could have cleared at Level III", targetRate: 2.50, levelTags: ["III"], keywords: ["PURCHASING", "PRODUCT 1"] },
  { brand: "V", name: "PURCHASING CARD PRESENT", rate: 2.50, reason: "Missing billing address/zip code/invoice number/sales tax Information - Could have cleared at Level III (Unless Tax Exempt)", targetRate: 1.85, levelTags: ["III"], keywords: ["PURCHASING", "CARD PRESENT"] },
  { brand: "V", name: "PURCHASING LEVEL II", rate: 2.50, reason: "Missing Level III Information - Could have cleared at Level III (Unless Tax Exempt)", targetRate: 1.90, levelTags: ["III"], keywords: ["PURCHASING", "LEVEL 2"] },
  // Mastercard L3
  { brand: "M", name: "BUSINESS CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Data III Business", targetRate: 1.80, levelTags: ["III"], keywords: ["BUS", "CARD", "STD"], informational: true },
  { brand: "M", name: "CORPORATE CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Data III Corporate", targetRate: 1.90, levelTags: ["III"], keywords: ["CORP", "CARD", "STD"], informational: true },
  { brand: "M", name: "PURCHASING CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Data III Purchasing", targetRate: 1.90, levelTags: ["III"], keywords: ["PUR", "CARD", "STD"], informational: true },
  { brand: "M", name: "FLEET CARD STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Data III Fleet (Unless Tax Exempt) OR Missing Multiple Data Fields", targetRate: 1.90, levelTags: ["III"], keywords: ["FLEET", "STD"], informational: true },
  { brand: "M", name: "HIGH VALUE STD", rate: 3.15, reason: "Delayed Settlement/Forced Auth - Could have cleared at Data III (Unless Tax Exempt) OR Missing Multiple Data Fields", targetRate: 1.90, levelTags: ["III"], keywords: ["HIGH VALUE", "STD"], informational: true },
  { brand: "M", name: "CORP DATA RATE I (US) BUS", rate: 2.65, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data II", targetRate: 1.90, levelTags: ["III"], keywords: ["DATA RATE 1", "CORP", "BUS"] },
  { brand: "M", name: "CORP DATA RATE I (US) CORP", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data III", targetRate: 1.90, levelTags: ["III"], keywords: ["DATA RATE 1", "CORP"] },
  { brand: "M", name: "CORP DATA RATE (1) PUR", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data III", targetRate: 2.10, levelTags: ["III"], keywords: ["DATA RATE 1", "PUR"] },
  { brand: "M", name: "COM DATA RATE 1 FLT NFUEL", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data III", targetRate: 2.05, levelTags: ["III"], keywords: ["DATA RATE 1", "FLT", "NFUEL"] },
  { brand: "M", name: "LARGE MARKET DATA RATE I", rate: 2.70, reason: "Missing billing address/zip code/invoice number/sales tax Information / Could have cleared at Data III", targetRate: 1.80, levelTags: ["III"], keywords: ["LARGE MARKET", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 1 DATA RATE 1", rate: 2.65, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level I Merchant", targetRate: 1.90, levelTags: ["III"], keywords: ["BUS", "LEVEL 1", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 2 DATA RATE 1", rate: 2.80, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 2 Merchant", targetRate: 2.05, levelTags: ["III"], keywords: ["BUS", "LEVEL 2", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 3 DATA RATE 1", rate: 2.85, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 3 Merchant", targetRate: 2.10, levelTags: ["III"], keywords: ["BUS", "LEVEL 3", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 4 DATA RATE 1", rate: 2.95, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 4 Merchant", targetRate: 2.20, levelTags: ["III"], keywords: ["BUS", "LEVEL 4", "DATA RATE 1"] },
  { brand: "M", name: "BUS LEVEL 5 DATA RATE 1", rate: 3.00, reason: "Tax Exempt Transaction or Missing Data Rate II Information - Level 5 Merchant", targetRate: 2.25, levelTags: ["III"], keywords: ["BUS", "LEVEL 5", "DATA RATE 1"] },
  // L3-only: MC CORP DATA RATE II variants (downgrade from Rate II to Rate III)
  { brand: "M", name: "CORP DATA RATE II (US) CORP", rate: 2.50, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.90, levelTags: ["III"], keywords: ["DATA RATE 2", "US"] },
  { brand: "M", name: "CORP DATA RATE II (US) CORP WORLD", rate: 2.15, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.80, levelTags: ["III"], keywords: ["DATA RATE 2", "WORLD"] },
  { brand: "M", name: "CORP DATA RATE II (US) CORP WORLD ELITE", rate: 2.15, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.80, levelTags: ["III"], keywords: ["DATA RATE 2", "WORLD ELITE"] },
  { brand: "M", name: "CORP DATA RATE II (US) PURCH", rate: 2.50, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.90, levelTags: ["III"], keywords: ["DATA RATE 2", "PUR"] },
  { brand: "M", name: "CORP DATA RATE II (US) FLEET", rate: 2.50, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.90, levelTags: ["III"], keywords: ["DATA RATE 2", "FLEET"] },
  { brand: "M", name: "CORP DATA RATE II (US) LRG MKT", rate: 2.50, reason: "Missing Level III Data - Could have cleared at Data III", targetRate: 1.80, levelTags: ["III"], keywords: ["DATA RATE 2", "LRG"] },
  { brand: "M", name: "BUSINESS LEVEL 2 STANDARD", rate: 3.10, reason: "Tax Exempt Transaction or Missing Multiple Data Fields - Level 2 Merchant", targetRate: 2.05, levelTags: ["III"], keywords: ["BUS", "LEVEL 2", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 3 STANDARD", rate: 3.15, reason: "Tax Exempt Transaction or Missing Multiple Data Fields - Level 3 Merchant", targetRate: 2.10, levelTags: ["III"], keywords: ["BUS", "LEVEL 3", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 4 STANDARD", rate: 3.25, reason: "Tax Exempt Transaction or Missing Multiple Data Fields - Level 4 Merchant", targetRate: 2.20, levelTags: ["III"], keywords: ["BUS", "LEVEL 4", "STANDARD"] },
  { brand: "M", name: "BUSINESS LEVEL 5 STANDARD", rate: 3.30, reason: "Tax Exempt Transaction or Missing Multiple Data Fields - Level 5 Merchant", targetRate: 2.25, levelTags: ["III"], keywords: ["BUS", "LEVEL 5", "STANDARD"] },
];

const rules: RuleSeed[] = [...l2Rules, ...l3Rules];

export async function seed() {
  console.log(`Seeding via ${getBackend()} backend...`);

  // Idempotency: only populate tables that are empty. Any UI edits you've
  // made to rules/ISOs survive re-seeding.
  const existingIsos = await storage.listProcessorISOs();
  if (existingIsos.length > 0) {
    console.log(`  processor_isos already has ${existingIsos.length} rows — skipping`);
  } else {
    console.log(`  Seeding ${isos.length} processor ISOs...`);
    for (const iso of isos) {
      await storage.createProcessorISO({
        name: iso.name,
        aliases: iso.aliases,
        enabled: true,
      });
    }
  }

  const existingRules = await storage.listDowngradeRules();
  if (existingRules.length > 0) {
    console.log(`  downgrade_rules already has ${existingRules.length} rows — skipping`);
  } else {
    console.log(`  Seeding ${rules.length} downgrade rules...`);
    for (const r of rules) {
      await storage.createDowngradeRule({
        brand: r.brand,
        name: r.name,
        rate: r.rate,
        reason: r.reason,
        targetRate: r.targetRate,
        levelTags: r.levelTags,
        keywords: r.keywords,
        enabled: true,
        informational: r.informational || false,
      });
    }
  }

  console.log("Seed complete.");
}

// Run directly: npx tsx server/db/seed.ts
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed")) {
  seed()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    });
}
