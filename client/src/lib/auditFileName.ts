/**
 * Convert a "YYYY-MM" statement month to "Month Year" (e.g. "2025-12" →
 * "December 2025"). Free-form values pass through unchanged so we never
 * mangle a month the user typed in their own format.
 */
export function formatStatementMonthLong(month: string): string {
  const m = /^(\d{4})-(\d{1,2})$/.exec((month || "").trim());
  if (!m) return (month || "").trim();
  const [, year, monthNum] = m;
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

/**
 * Build the downloaded-PDF filename using Amanda's existing convention so
 * generated reports drop into her workflow without renaming. Pattern:
 *   "<Merchant>[ <MID-tail>] <Month> <Year> Audit.pdf"
 * The MID-tail is appended only when not already present in the merchant
 * string (Companies-roster names sometimes already include it).
 */
export function buildAuditPdfFileName(merchant: string, statementMonth: string, mid: string): string {
  const cleanedMerchant = (merchant || "").trim() || "Audit";
  const tail = (mid || "").replace(/\D/g, "").slice(-4);
  const tailPart = tail && !cleanedMerchant.includes(tail) ? ` ${tail}` : "";
  const monthPart = formatStatementMonthLong(statementMonth);
  const monthSegment = monthPart ? ` ${monthPart}` : "";
  const raw = `${cleanedMerchant}${tailPart}${monthSegment} Audit.pdf`;
  return raw.replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}
