/**
 * Official Interchange Benchmark Rates
 *
 * These are the CORRECT rates for transactions that qualify properly
 * (as opposed to downgrade rates for transactions with missing data)
 *
 * Source: Visa/Mastercard official interchange tables
 */

export interface InterchangeBenchmark {
  category: string;              // Human-readable name
  brand: "V" | "M";             // Visa or Mastercard
  officialRate: number;         // Official percentage (e.g., 1.95 for 1.95%)
  officialFee: number;          // Official per-transaction fee in dollars (e.g., 0.10 for $0.10)
  keywords: string[];           // Keywords to match in statement lines
  description: string;          // What this category represents
  processorVariations?: {       // Processor-specific naming variations
    [processor: string]: string[];
  };
}

/**
 * Visa Interchange Benchmarks
 * For transactions that clear WITH proper data (Level II/III qualified)
 */
const visaBenchmarks: InterchangeBenchmark[] = [
  // ── Visa CPS (Card Present Swiped) ───────────────────────────────────────
  {
    category: "CPS Retail",
    brand: "V",
    officialRate: 1.51,
    officialFee: 0.10,
    keywords: ["CPS", "RETAIL"],
    description: "Visa Card Present Swiped - Retail transactions settled within 2 days",
  },
  {
    category: "CPS Small Ticket",
    brand: "V",
    officialRate: 1.65,
    officialFee: 0.04,
    keywords: ["CPS", "SMALL", "TICKET"],
    description: "Visa Card Present Small Ticket - Transactions under $15",
  },
  {
    category: "CPS Supermarket",
    brand: "V",
    officialRate: 1.15,
    officialFee: 0.05,
    keywords: ["CPS", "SUPERMARKET"],
    description: "Visa Card Present Supermarket - Grocery stores with special MCC",
  },

  // ── Visa Retail P2 (Consumer Cards) ──────────────────────────────────────
  {
    category: "Retail P2 Signature Preferred",
    brand: "V",
    officialRate: 1.65,
    officialFee: 0.10,
    keywords: ["RETAIL", "P2", "SIGN", "PREFERRED"],
    description: "Visa consumer signature preferred rewards card",
    processorVariations: {
      CardConnect: ["VI-RETAIL P2 SIGN PREFERRED"],
    },
  },
  {
    category: "Retail P2 Traditional",
    brand: "V",
    officialRate: 1.43,
    officialFee: 0.05,
    keywords: ["RETAIL", "P2", "TRAD"],
    description: "Visa consumer traditional non-rewards card",
    processorVariations: {
      CardConnect: ["VI-RETAIL P2 TRAD", "VI-RETAIL ALL OTHER P2 TRAD"],
    },
  },
  {
    category: "Retail P2 Infinite",
    brand: "V",
    officialRate: 2.00,
    officialFee: 0.10,
    keywords: ["RETAIL", "P2", "INFINITE"],
    description: "Visa Infinite premium consumer card",
    processorVariations: {
      CardConnect: ["VI-RETAIL P2 INFINITE"],
    },
  },

  // ── Visa Business Card (Qualified Level II/III) ──────────────────────────
  {
    category: "Business Tier 1 Level 2",
    brand: "V",
    officialRate: 1.85,
    officialFee: 0.10,
    keywords: ["BUS", "T1", "LEVEL 2"],
    description: "Visa Business Tier 1 qualified with Level II data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR1 LEVEL 2"],
    },
  },
  {
    category: "Business Tier 2 Level 2",
    brand: "V",
    officialRate: 1.90,
    officialFee: 0.10,
    keywords: ["BUS", "T2", "LEVEL 2"],
    description: "Visa Business Tier 2 qualified with Level II data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR2 LEVEL 2"],
    },
  },
  {
    category: "Business Tier 3 Level 2",
    brand: "V",
    officialRate: 1.95,
    officialFee: 0.10,
    keywords: ["BUS", "T3", "LEVEL 2"],
    description: "Visa Business Tier 3 qualified with Level II data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR3 LEVEL 2"],
    },
  },
  {
    category: "Business Tier 4 Level 2",
    brand: "V",
    officialRate: 2.00,
    officialFee: 0.10,
    keywords: ["BUS", "T4", "LEVEL 2"],
    description: "Visa Business Tier 4 qualified with Level II data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR4 LEVEL 2"],
    },
  },
  {
    category: "Business Tier 5 Level 2",
    brand: "V",
    officialRate: 2.05,
    officialFee: 0.10,
    keywords: ["BUS", "T5", "LEVEL 2"],
    description: "Visa Business Tier 5 qualified with Level II data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR5 LEVEL 2"],
    },
  },
  {
    category: "Business Tier 3 Level 3",
    brand: "V",
    officialRate: 1.85,
    officialFee: 0.10,
    keywords: ["BUS", "T3", "LEVEL 3"],
    description: "Visa Business Tier 3 qualified with Level III data",
    processorVariations: {
      CardConnect: ["VI-BUSINESS CARD TR3 LEVEL 3"],
    },
  },

  // ── Visa Corporate/Purchasing (Qualified) ────────────────────────────────
  {
    category: "Corporate Level 2",
    brand: "V",
    officialRate: 1.95,
    officialFee: 0.10,
    keywords: ["CORP", "LEVEL 2"],
    description: "Visa Corporate card qualified with Level II data",
  },
  {
    category: "Purchasing Level 2",
    brand: "V",
    officialRate: 2.30,
    officialFee: 0.10,
    keywords: ["PURCHASING", "LEVEL 2"],
    description: "Visa Purchasing card qualified with Level II data",
  },
  {
    category: "Purchasing Level 3",
    brand: "V",
    officialRate: 1.80,
    officialFee: 0.10,
    keywords: ["PURCHASING", "LEVEL 3"],
    description: "Visa Purchasing card qualified with Level III data",
  },

  // ── Visa Regulated Debit ─────────────────────────────────────────────────
  {
    category: "US Regulated Debit",
    brand: "V",
    officialRate: 0.05,
    officialFee: 0.22,
    keywords: ["REGULATED", "DB"],
    description: "Visa US Regulated Debit - Durbin capped rate",
    processorVariations: {
      CardConnect: ["VI-US REGULATED (DB)", "VI-US REGULATED COMM (DB)"],
    },
  },
];

/**
 * Mastercard Interchange Benchmarks
 * For transactions that clear WITH proper data (Data Rate II/III qualified)
 */
const mastercardBenchmarks: InterchangeBenchmark[] = [
  // ── Mastercard Merit (Consumer Cards) ────────────────────────────────────
  {
    category: "Merit I",
    brand: "M",
    officialRate: 1.55,
    officialFee: 0.10,
    keywords: ["MERIT", "I"],
    description: "Mastercard consumer card Merit I tier",
    processorVariations: {
      CardConnect: ["MC-ENHANCED MERIT I"],
    },
  },
  {
    category: "Merit III",
    brand: "M",
    officialRate: 1.80,
    officialFee: 0.10,
    keywords: ["MERIT", "III"],
    description: "Mastercard consumer card Merit III tier (premium rewards)",
    processorVariations: {
      CardConnect: ["MC-DOMESTIC MERIT III", "MC-WORLD MERIT III", "MC-WORLD ELITE MERIT III"],
    },
  },

  // ── Mastercard Business (Qualified Data Rate II/III) ─────────────────────
  {
    category: "Business Level 1 Data Rate II",
    brand: "M",
    officialRate: 1.85,
    officialFee: 0.10,
    keywords: ["BUS", "LEVEL 1", "DATA RATE", "II"],
    description: "MC Business Level 1 qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-BUS LEVEL 1 DATA RATE II"],
    },
  },
  {
    category: "Business Level 2 Data Rate II",
    brand: "M",
    officialRate: 1.90,
    officialFee: 0.10,
    keywords: ["BUS", "LEVEL 2", "DATA RATE", "II"],
    description: "MC Business Level 2 qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-BUS LEVEL 2 DATA RATE II"],
    },
  },
  {
    category: "Business Level 3 Data Rate II",
    brand: "M",
    officialRate: 1.95,
    officialFee: 0.10,
    keywords: ["BUS", "LEVEL 3", "DATA RATE", "II"],
    description: "MC Business Level 3 qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-BUS LEVEL 3 DATA RATE II"],
    },
  },
  {
    category: "Business Level 4 Data Rate II",
    brand: "M",
    officialRate: 2.00,
    officialFee: 0.10,
    keywords: ["BUS", "LEVEL 4", "DATA RATE", "II"],
    description: "MC Business Level 4 qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-BUS LEVEL 4 DATA RATE II"],
    },
  },
  {
    category: "Business Level 5 Data Rate II",
    brand: "M",
    officialRate: 2.05,
    officialFee: 0.10,
    keywords: ["BUS", "LEVEL 5", "DATA RATE", "II"],
    description: "MC Business Level 5 qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-BUS LEVEL 5 DATA RATE II"],
    },
  },

  // ── Mastercard Corporate ─────────────────────────────────────────────────
  {
    category: "Corporate Data Rate II",
    brand: "M",
    officialRate: 1.95,
    officialFee: 0.10,
    keywords: ["CORP", "DATA RATE", "II"],
    description: "MC Corporate card qualified with Data Rate II",
    processorVariations: {
      CardConnect: ["MC-CORP DATA RATE II"],
    },
  },

  // ── Mastercard High Value ────────────────────────────────────────────────
  {
    category: "High Value Merit III",
    brand: "M",
    officialRate: 2.10,
    officialFee: 0.10,
    keywords: ["HIGH", "VAL", "MERIT", "III"],
    description: "MC High Value premium card",
    processorVariations: {
      CardConnect: ["MC-HIGH VAL MERIT III"],
    },
  },

  // ── Mastercard Regulated Debit ───────────────────────────────────────────
  {
    category: "Regulated Debit",
    brand: "M",
    officialRate: 0.05,
    officialFee: 0.22,
    keywords: ["REGULATED", "DB"],
    description: "MC US Regulated Debit - Durbin capped rate",
    processorVariations: {
      CardConnect: ["MC-REGULATED", "MC-REG"],
    },
  },
];

export const INTERCHANGE_BENCHMARKS = [...visaBenchmarks, ...mastercardBenchmarks];
