import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type FindingRow = {
  label: string;
  count: number;
  volume: string;
  rate: string;
  chargedRate?: string;
  correctedRate?: string;
  revenueLost: string;
  reasons: string;
  severity?: "High" | "Medium" | "Low";
};

type ServiceChargeRow = {
  label: string;
  rawLine?: string;
  chargedRate: number;
  contractedRate: number;
  overcharge: boolean;
  overchargeAmount: number;
  severity?: "High" | "Medium" | "Low";
};

type InterchangeRow = {
  label: string;
  volume: string;
  rate: string;
  page: number;
};

type AuditReportData = {
  auditId: string;
  merchant: string;
  location: string;
  statementMonth: string;
  processor: string;
  mid: string;
  volume: string;
  totalFees?: string;
  amexVolume?: string;
  amexFees?: string;
  status: "Complete" | "Needs Review" | "In Progress";
  summary: {
    discountSavings: string;
    revenueLost: string;
  };
  flags: {
    nonPci: number;
    downgrades: number;
    serviceCharges?: number;
    serviceChargeOvercharges?: number;
    interchange?: number;
  };
  findings: {
    nonPci: FindingRow[];
    downgrades: FindingRow[];
    serviceCharges?: ServiceChargeRow[];
    interchange?: InterchangeRow[];
  };
  gatewayLevel?: "II" | "III";
  notes?: string;
};

/* ── Color palette — mirrors the reference (clean white + lime green table headers) ── */
const C = {
  white: "#FFFFFF",
  text: "#111827",
  textMuted: "#4B5563",
  textFaint: "#6B7280",
  divider: "#E5E7EB",
  divLight: "#F3F4F6",
  green: "#9DBE5A",     // table header green from the reference
  greenDark: "#6E8C2E",
  red: "#B91C1C",
  redBg: "#B91C1C",     // solid red banner
  brandPurple: "#2E1065",
  brandYellow: "#EAB308",
  amber: "#B45309",
  blue: "#1D4ED8",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.text,
    backgroundColor: C.white,
  },

  /* ── Header ── */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logoBlock: {
    width: 130,
  },
  logoBox: {
    backgroundColor: C.brandPurple,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    width: 86,
  },
  logoLine1: {
    color: C.white,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  logoLine2: {
    color: C.brandYellow,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: -0.5,
    marginTop: -2,
  },
  logoTagline: {
    fontSize: 7,
    color: C.brandYellow,
    marginTop: 2,
  },
  logoSubtitle: {
    fontSize: 7,
    color: C.textFaint,
    marginTop: 6,
  },

  metaBlock: {
    width: 240,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  metaLabel: {
    fontSize: 9,
    color: C.text,
  },
  metaValue: {
    fontSize: 10,
    color: C.text,
    fontWeight: 700,
  },

  /* ── Merchant identity row ── */
  merchantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 16,
  },
  merchantId: {
    fontSize: 11,
    color: C.text,
  },
  merchantSub: {
    fontSize: 8,
    color: C.textFaint,
    marginTop: 2,
  },

  /* ── Investigation banner (red) ── */
  bannerRed: {
    backgroundColor: C.redBg,
    color: C.white,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 9,
    fontWeight: 700,
    marginTop: 10,
  },

  /* ── Total revenue lost line ── */
  totalLossRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 12,
  },
  totalLossLabel: {
    fontSize: 10,
    color: C.text,
  },
  totalLossValue: {
    fontSize: 11,
    color: C.text,
    fontWeight: 700,
  },

  caveat: {
    fontSize: 8,
    color: C.text,
    fontStyle: "italic",
    fontWeight: 700,
    marginTop: 12,
    textAlign: "center",
  },

  /* ── CTA ── */
  ctaTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.text,
    marginTop: 14,
    textAlign: "center",
  },
  ctaBody: {
    fontSize: 9,
    color: C.text,
    marginTop: 4,
    lineHeight: 1.4,
  },

  /* ── Mini-table (one per finding row, matches reference style) ── */
  miniTable: {
    marginTop: 12,
  },
  miniHeader: {
    flexDirection: "row",
    backgroundColor: C.green,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  miniHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: C.white,
  },
  miniRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  miniCell: {
    fontSize: 9,
    color: C.text,
  },
  miniReason: {
    fontSize: 8,
    color: C.text,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  /* Column widths for downgrade-style tables: # | Volume | Downgrade | Rate | If Corrected | Revenue Lost */
  col1: { width: "8%" },
  col2: { width: "13%" },
  col3: { width: "37%" },
  col4: { width: "12%", textAlign: "right" },
  col5: { width: "13%", textAlign: "right" },
  col6: { width: "17%", textAlign: "right" },

  /* ── Section heading ── */
  sectionHeading: {
    fontSize: 10,
    fontWeight: 700,
    color: C.text,
    marginTop: 18,
    marginBottom: 4,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginBottom: 4,
  },

  /* ── Service-charge table columns ── */
  sc1: { width: "40%" },
  sc2: { width: "15%", textAlign: "right" },
  sc3: { width: "15%", textAlign: "right" },
  sc4: { width: "12%", textAlign: "center" },
  sc5: { width: "18%", textAlign: "right" },

  /* ── Interchange table columns ── */
  ic1: { width: "55%" },
  ic2: { width: "20%", textAlign: "right" },
  ic3: { width: "15%", textAlign: "right" },
  ic4: { width: "10%", textAlign: "center" },

  /* ── Footer ── */
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  footerText: {
    fontSize: 7,
    color: C.textFaint,
    maxWidth: "75%",
    lineHeight: 1.4,
  },
  footerBrand: {
    fontSize: 7,
    color: C.textFaint,
  },
});

/** Build the merchant identifier line — `<Name> - L<level> -<MID-tail>` per Amanda's reports. */
function buildMerchantId(merchant: string, mid: string, gatewayLevel?: "II" | "III") {
  const tail = (mid || "").replace(/\D/g, "").slice(-4);
  const level = gatewayLevel ? ` - L${gatewayLevel === "II" ? "2" : "3"}` : "";
  const tailPart = tail ? ` -${tail}` : "";
  return `${merchant}${level}${tailPart}`;
}

/** A reference-style downgrade row: green header bar, single data row, italic reason underneath. */
function DowngradeRow({ row }: { row: FindingRow }) {
  return (
    <View style={styles.miniTable} wrap={false}>
      <View style={styles.miniHeader}>
        <Text style={[styles.miniHeaderText, styles.col1]}># of Trans</Text>
        <Text style={[styles.miniHeaderText, styles.col2]}>Volume</Text>
        <Text style={[styles.miniHeaderText, styles.col3]}>Downgrade</Text>
        <Text style={[styles.miniHeaderText, styles.col4]}>Downgrade Rate</Text>
        <Text style={[styles.miniHeaderText, styles.col5]}>If Corrected</Text>
        <Text style={[styles.miniHeaderText, styles.col6]}>Revenue Lost</Text>
      </View>
      <View style={styles.miniRow}>
        <Text style={[styles.miniCell, styles.col1]}>{row.count}</Text>
        <Text style={[styles.miniCell, styles.col2]}>{row.volume}</Text>
        <Text style={[styles.miniCell, styles.col3]}>{row.label}</Text>
        <Text style={[styles.miniCell, styles.col4]}>{row.chargedRate ?? row.rate}</Text>
        <Text style={[styles.miniCell, styles.col5]}>{row.correctedRate ?? "—"}</Text>
        <Text style={[styles.miniCell, styles.col6]}>{row.revenueLost}</Text>
      </View>
      <Text style={styles.miniReason}>{row.reasons}</Text>
    </View>
  );
}

/** Non-PCI rows reuse the same layout but the rate columns aren't meaningful — we collapse them. */
function NonPciRow({ row }: { row: FindingRow }) {
  return (
    <View style={styles.miniTable} wrap={false}>
      <View style={styles.miniHeader}>
        <Text style={[styles.miniHeaderText, styles.col1]}># of Trans</Text>
        <Text style={[styles.miniHeaderText, styles.col2]}>Volume</Text>
        <Text style={[styles.miniHeaderText, { width: "62%" }]}>Non-PCI Fee</Text>
        <Text style={[styles.miniHeaderText, styles.col6]}>Revenue Lost</Text>
      </View>
      <View style={styles.miniRow}>
        <Text style={[styles.miniCell, styles.col1]}>{row.count}</Text>
        <Text style={[styles.miniCell, styles.col2]}>{row.volume}</Text>
        <Text style={[styles.miniCell, { width: "62%" }]}>{row.label}</Text>
        <Text style={[styles.miniCell, styles.col6]}>{row.revenueLost}</Text>
      </View>
      <Text style={styles.miniReason}>{row.reasons}</Text>
    </View>
  );
}

function ServiceChargeRow({ row }: { row: ServiceChargeRow }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  return (
    <View style={styles.miniTable} wrap={false}>
      <View style={styles.miniHeader}>
        <Text style={[styles.miniHeaderText, styles.sc1]}>Service Charge</Text>
        <Text style={[styles.miniHeaderText, styles.sc2]}>Charged</Text>
        <Text style={[styles.miniHeaderText, styles.sc3]}>Contracted</Text>
        <Text style={[styles.miniHeaderText, styles.sc4]}>Status</Text>
        <Text style={[styles.miniHeaderText, styles.sc5]}>Overcharge</Text>
      </View>
      <View style={styles.miniRow}>
        <Text style={[styles.miniCell, styles.sc1]}>{row.label}</Text>
        <Text style={[styles.miniCell, styles.sc2]}>{row.chargedRate.toFixed(4)}%</Text>
        <Text style={[styles.miniCell, styles.sc3]}>{row.contractedRate.toFixed(4)}%</Text>
        <Text style={[styles.miniCell, styles.sc4]}>{row.overcharge ? "OVER" : "OK"}</Text>
        <Text style={[styles.miniCell, styles.sc5]}>
          {row.overcharge ? fmt(row.overchargeAmount) : "—"}
        </Text>
      </View>
      {row.rawLine && <Text style={styles.miniReason}>{row.rawLine}</Text>}
    </View>
  );
}

function InterchangeBlock({ rows }: { rows: InterchangeRow[] }) {
  return (
    <View style={styles.miniTable}>
      <View style={styles.miniHeader}>
        <Text style={[styles.miniHeaderText, styles.ic1]}>Line Item</Text>
        <Text style={[styles.miniHeaderText, styles.ic2]}>Volume</Text>
        <Text style={[styles.miniHeaderText, styles.ic3]}>Rate</Text>
        <Text style={[styles.miniHeaderText, styles.ic4]}>Pg</Text>
      </View>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={styles.miniRow} wrap={false}>
          <Text style={[styles.miniCell, styles.ic1, { fontSize: 8 }]}>{r.label}</Text>
          <Text style={[styles.miniCell, styles.ic2]}>{r.volume}</Text>
          <Text style={[styles.miniCell, styles.ic3]}>{r.rate}</Text>
          <Text style={[styles.miniCell, styles.ic4]}>{r.page}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AuditReportDocument({ data }: { data: AuditReportData }) {
  const merchantLine = buildMerchantId(data.merchant, data.mid, data.gatewayLevel);
  const scOvercharges = data.flags.serviceChargeOvercharges ?? 0;
  const showInvestigationBanner = data.flags.nonPci > 0 || scOvercharges > 0;
  const downgrades = [...data.findings.downgrades].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.severity ?? "Low"] ?? 2) - (order[b.severity ?? "Low"] ?? 2);
  });
  const serviceCharges = data.findings.serviceCharges ?? [];
  const interchange = data.findings.interchange ?? [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.logoBlock}>
            <View style={styles.logoBox}>
              <Text style={styles.logoLine1}>we</Text>
              <Text style={styles.logoLine2}>Audit</Text>
              <Text style={styles.logoTagline}>.com</Text>
            </View>
            <Text style={styles.logoSubtitle}>Protecting merchants' profits</Text>
          </View>

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Discount Savings</Text>
              <Text style={styles.metaValue}>{data.summary.discountSavings}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Processing Volume</Text>
              <Text style={styles.metaValue}>{data.volume}</Text>
            </View>
            <View style={[styles.metaRow, { marginTop: 4 }]}>
              <Text style={styles.metaLabel}>Based on:</Text>
              <Text style={styles.metaLabel}>{data.statementMonth}</Text>
            </View>
            {data.processor && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Processor:</Text>
                <Text style={styles.metaLabel}>{data.processor}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Merchant identifier ── */}
        <View>
          <Text style={styles.merchantId}>{merchantLine}</Text>
        </View>

        {/* ── Investigation banner ── */}
        {showInvestigationBanner && (
          <Text style={styles.bannerRed}>
            Processor Fees and or charges did not match. Pending Investigation
          </Text>
        )}

        {/* ── Total revenue lost ── */}
        <View style={styles.totalLossRow}>
          <Text style={styles.totalLossLabel}>Total Revenue Lost</Text>
          <Text style={styles.totalLossValue}>{data.summary.revenueLost}</Text>
        </View>

        {/* ── Caveat ── */}
        <Text style={styles.caveat}>
          Many of the downgrades have several reasons behind them, but this report only shows the most likely reason.
        </Text>

        {/* ── CTA ── */}
        {(downgrades.length > 0 || data.findings.nonPci.length > 0 || scOvercharges > 0) && (
          <>
            <Text style={styles.ctaTitle}>PLEASE CONTACT US ASAP</Text>
            <Text style={styles.ctaBody}>
              Your processor has increased your fees and has refused to return them to the agreed
              upon rate. Please contact us ASAP to discuss your options. Thank you!
            </Text>
          </>
        )}

        {/* ── Non-PCI findings ── */}
        {data.findings.nonPci.length > 0 && (
          <>
            {data.findings.nonPci.map((r, i) => (
              <NonPciRow key={`npci-${i}`} row={r} />
            ))}
          </>
        )}

        {/* ── Downgrade findings — one mini-table per row, like the reference ── */}
        {downgrades.map((r, i) => (
          <DowngradeRow key={`dg-${i}`} row={r} />
        ))}

        {/* ── Service charges ── */}
        {serviceCharges.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Service Charges</Text>
            <View style={styles.sectionDivider} />
            {serviceCharges.map((r, i) => (
              <ServiceChargeRow key={`sc-${i}`} row={r} />
            ))}
          </>
        )}

        {/* ── Interchange qualification lines ── */}
        {interchange.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Interchange Qualification Lines</Text>
            <View style={styles.sectionDivider} />
            <InterchangeBlock rows={interchange} />
          </>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Figures are estimates derived from statement text extraction and rules-based classification.
            Validate against processor pricing schedules and interchange tables.
          </Text>
          <Text style={styles.footerBrand}>
            weAudit  {"·"}  {data.statementMonth}  {"·"}  {data.auditId}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export type { AuditReportData };
