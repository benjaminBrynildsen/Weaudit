import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type FindingRow = {
  label: string;
  count: number;
  volume: string;
  rate: string;
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
  notes?: string;
};

/* ── Color palette ── */
const C = {
  navy: "#0A0F1E",
  navyMid: "#141B2D",
  navyLight: "#1E2A3E",
  slate: "#64748B",
  slateLight: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  bg: "#FAFBFC",
  white: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  green: "#059669",
  greenBg: "#ECFDF5",
  greenBorder: "#A7F3D0",
  red: "#DC2626",
  redBg: "#FEF2F2",
  redBorder: "#FECACA",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  amberBorder: "#FDE68A",
  blue: "#2563EB",
  blueBg: "#EFF6FF",
  blueBorder: "#BFDBFE",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: C.text,
    backgroundColor: C.bg,
  },

  /* ── Header ── */
  headerWrap: {
    backgroundColor: C.navy,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 36,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  brandBlock: {},
  brand: {
    fontSize: 20,
    fontWeight: 700,
    color: C.white,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 8,
    color: C.slateLight,
    marginTop: 2,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  headerMeta: {
    alignItems: "flex-end",
  },
  headerMetaText: {
    fontSize: 8,
    color: C.slateLight,
    marginBottom: 2,
  },
  headerMetaValue: {
    fontSize: 9,
    color: C.white,
    fontWeight: 700,
  },
  headerDivider: {
    height: 1,
    backgroundColor: C.navyLight,
    marginBottom: 12,
  },
  merchantName: {
    fontSize: 14,
    fontWeight: 700,
    color: C.white,
    marginBottom: 4,
  },
  merchantDetails: {
    fontSize: 8,
    color: C.slateLight,
    lineHeight: 1.5,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
    backgroundColor: C.navyLight,
    fontSize: 8,
    color: C.white,
  },
  pillAccent: {
    backgroundColor: C.blue,
  },

  /* ── Body ── */
  body: {
    paddingHorizontal: 36,
    paddingTop: 20,
  },

  /* ── Summary cards ── */
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: C.white,
  },
  summaryCardAccent: {
    borderColor: C.greenBorder,
    backgroundColor: C.greenBg,
  },
  summaryCardWarn: {
    borderColor: C.redBorder,
    backgroundColor: C.redBg,
  },
  summaryLabel: {
    fontSize: 8,
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 700,
  },
  summaryValueGreen: { color: C.green },
  summaryValueRed: { color: C.red },

  /* ── Stats row ── */
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: C.white,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
  },
  statLabel: {
    fontSize: 7,
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },

  /* ── Status banner ── */
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { fontSize: 9, fontWeight: 700 },
  bannerBody: { fontSize: 8, color: C.textMuted, marginTop: 1 },

  /* ── Section heading ── */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.text,
  },
  sectionCount: {
    fontSize: 8,
    color: C.textMuted,
    marginLeft: "auto",
  },

  /* ── Table ── */
  tableWrap: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: C.white,
    marginBottom: 18,
  },
  tr: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    minHeight: 28,
    alignItems: "center",
  },
  trFirst: {
    borderTopWidth: 0,
  },
  th: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 0,
    minHeight: 30,
  },
  cell: {
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  c1: { width: "22%" },
  c2: { width: "8%", textAlign: "center" },
  c3: { width: "15%", textAlign: "right" },
  c4: { width: "11%", textAlign: "right" },
  c5: { width: "15%", textAlign: "right" },
  c6: { width: "29%" },
  thText: {
    fontSize: 7,
    fontWeight: 700,
    color: C.slate,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tdText: { fontSize: 8, color: C.text },
  tdMuted: { fontSize: 8, color: C.textMuted },
  highRow: { backgroundColor: "#FEF2F2" },
  highBadge: {
    fontSize: 6,
    fontWeight: 700,
    color: C.red,
    backgroundColor: "#FEE2E2",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    marginTop: 3,
    alignSelf: "flex-start",
  },
  lostValue: {
    fontSize: 8,
    fontWeight: 700,
    color: C.red,
  },

  /* ── Service charge table ── */
  sc1: { width: "35%" },
  sc2: { width: "15%", textAlign: "right" },
  sc3: { width: "15%", textAlign: "right" },
  sc4: { width: "15%", textAlign: "center" },
  sc5: { width: "20%", textAlign: "right" },
  overchargeText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#7C3AED",
  },

  /* ── Interchange table ── */
  ic1: { width: "55%" },
  ic2: { width: "20%", textAlign: "right" },
  ic3: { width: "15%", textAlign: "right" },
  ic4: { width: "10%", textAlign: "center" },

  /* ── Footer ── */
  footerDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 6,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 36,
  },
  footerText: {
    fontSize: 7,
    color: C.slate,
    lineHeight: 1.4,
    maxWidth: "70%",
  },
  footerBrand: {
    fontSize: 7,
    color: C.slateLight,
    textAlign: "right",
  },
  notesBox: {
    marginTop: 8,
    paddingHorizontal: 36,
    paddingVertical: 8,
    paddingLeft: 36,
  },
  notesLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: C.slate,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: C.textMuted,
    lineHeight: 1.4,
  },
});

function statusToBanner(
  status: AuditReportData["status"],
  nonPci: number,
  downgrades: number,
) {
  if (status === "In Progress") {
    return {
      border: C.blueBorder,
      bg: C.blueBg,
      dot: C.blue,
      title: "Audit in progress",
      body: "Results may be partial until the scan completes.",
    };
  }
  if (nonPci > 0) {
    return {
      border: C.redBorder,
      bg: C.redBg,
      dot: C.red,
      title: "Non-PCI fees detected",
      body: "Charges flagged as non-PCI related or non-compliant fee structures.",
    };
  }
  if (downgrades > 0) {
    return {
      border: C.amberBorder,
      bg: C.amberBg,
      dot: C.amber,
      title: "Downgrades detected",
      body: "Qualification issues found that may increase effective rates.",
    };
  }
  return {
    border: C.greenBorder,
    bg: C.greenBg,
    dot: C.green,
    title: "No issues detected",
    body: "No non-PCI fees or downgrades flagged this period.",
  };
}

function Table({ rows, color }: { rows: FindingRow[]; color: "red" | "amber" }) {
  const sorted = [...rows].sort((a, b) => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return (order[a.severity ?? "Low"] ?? 2) - (order[b.severity ?? "Low"] ?? 2);
  });

  const accentColor = color === "red" ? C.red : C.amber;

  return (
    <View style={styles.tableWrap}>
      <View style={[styles.tr, styles.th]}>
        <View style={[styles.cell, styles.c1]}>
          <Text style={styles.thText}>Finding</Text>
        </View>
        <View style={[styles.cell, styles.c2]}>
          <Text style={styles.thText}>Count</Text>
        </View>
        <View style={[styles.cell, styles.c3]}>
          <Text style={styles.thText}>Volume</Text>
        </View>
        <View style={[styles.cell, styles.c4]}>
          <Text style={styles.thText}>Rate</Text>
        </View>
        <View style={[styles.cell, styles.c5]}>
          <Text style={styles.thText}>Rev. Lost</Text>
        </View>
        <View style={[styles.cell, styles.c6]}>
          <Text style={styles.thText}>Reason</Text>
        </View>
      </View>

      {sorted.map((r, idx) => (
        <View
          key={`${r.label}-${idx}`}
          style={[
            styles.tr,
            idx === 0 && styles.trFirst,
            r.severity === "High" && styles.highRow,
          ]}
        >
          <View style={[styles.cell, styles.c1]}>
            <Text style={styles.tdText}>{r.label}</Text>
            {r.severity === "High" && (
              <Text style={styles.highBadge}>HIGH PRIORITY</Text>
            )}
          </View>
          <View style={[styles.cell, styles.c2]}>
            <Text style={[styles.tdText, { textAlign: "center" }]}>{r.count}</Text>
          </View>
          <View style={[styles.cell, styles.c3]}>
            <Text style={styles.tdMuted}>{r.volume}</Text>
          </View>
          <View style={[styles.cell, styles.c4]}>
            <Text style={[styles.tdText, { color: accentColor }]}>{r.rate}</Text>
          </View>
          <View style={[styles.cell, styles.c5]}>
            <Text style={styles.lostValue}>{r.revenueLost}</Text>
          </View>
          <View style={[styles.cell, styles.c6]}>
            <Text style={styles.tdMuted}>{r.reasons}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ServiceChargeTable({ rows }: { rows: ServiceChargeRow[] }) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <View style={styles.tableWrap}>
      <View style={[styles.tr, styles.th]}>
        <View style={[styles.cell, styles.sc1]}>
          <Text style={styles.thText}>Fee</Text>
        </View>
        <View style={[styles.cell, styles.sc2]}>
          <Text style={styles.thText}>Charged</Text>
        </View>
        <View style={[styles.cell, styles.sc3]}>
          <Text style={styles.thText}>Expected</Text>
        </View>
        <View style={[styles.cell, styles.sc4]}>
          <Text style={styles.thText}>Status</Text>
        </View>
        <View style={[styles.cell, styles.sc5]}>
          <Text style={styles.thText}>Overcharge</Text>
        </View>
      </View>

      {rows.map((r, idx) => (
        <View
          key={`${r.label}-${idx}`}
          style={[
            styles.tr,
            idx === 0 && styles.trFirst,
            r.overcharge && { backgroundColor: "#F5F3FF" },
          ]}
        >
          <View style={[styles.cell, styles.sc1]}>
            <Text style={styles.tdText}>{r.label}</Text>
            {r.rawLine && <Text style={[styles.tdMuted, { fontSize: 7 }]}>{r.rawLine}</Text>}
          </View>
          <View style={[styles.cell, styles.sc2]}>
            <Text style={styles.tdText}>{r.chargedRate.toFixed(4)}%</Text>
          </View>
          <View style={[styles.cell, styles.sc3]}>
            <Text style={styles.tdMuted}>{r.contractedRate.toFixed(4)}%</Text>
          </View>
          <View style={[styles.cell, styles.sc4]}>
            <Text style={r.overcharge ? styles.overchargeText : styles.tdMuted}>
              {r.overcharge ? "OVER" : "OK"}
            </Text>
          </View>
          <View style={[styles.cell, styles.sc5]}>
            <Text style={r.overcharge ? styles.overchargeText : styles.tdMuted}>
              {r.overcharge ? money(r.overchargeAmount) : "—"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function InterchangeTable({ rows }: { rows: InterchangeRow[] }) {
  return (
    <View style={styles.tableWrap}>
      <View style={[styles.tr, styles.th]}>
        <View style={[styles.cell, styles.ic1]}>
          <Text style={styles.thText}>Line Item</Text>
        </View>
        <View style={[styles.cell, styles.ic2]}>
          <Text style={styles.thText}>Volume</Text>
        </View>
        <View style={[styles.cell, styles.ic3]}>
          <Text style={styles.thText}>Rate</Text>
        </View>
        <View style={[styles.cell, styles.ic4]}>
          <Text style={styles.thText}>Pg</Text>
        </View>
      </View>

      {rows.map((r, idx) => (
        <View key={`${r.label}-${idx}`} style={[styles.tr, idx === 0 && styles.trFirst]}>
          <View style={[styles.cell, styles.ic1]}>
            <Text style={[styles.tdText, { fontSize: 7 }]}>{r.label}</Text>
          </View>
          <View style={[styles.cell, styles.ic2]}>
            <Text style={styles.tdMuted}>{r.volume}</Text>
          </View>
          <View style={[styles.cell, styles.ic3]}>
            <Text style={[styles.tdText, { color: "#2563EB" }]}>{r.rate}</Text>
          </View>
          <View style={[styles.cell, styles.ic4]}>
            <Text style={styles.tdMuted}>{r.page}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AuditReportDocument({ data }: { data: AuditReportData }) {
  const banner = statusToBanner(data.status, data.flags.nonPci, data.flags.downgrades);
  const scCount = data.flags.serviceCharges ?? 0;
  const scOvercharges = data.flags.serviceChargeOvercharges ?? 0;
  const icCount = data.flags.interchange ?? 0;
  const totalFindings = data.flags.nonPci + data.flags.downgrades + scCount + icCount;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.headerWrap}>
          <View style={styles.headerTop}>
            <View style={styles.brandBlock}>
              <Text style={styles.brand}>weAudit</Text>
              <Text style={styles.brandSub}>Statement Audit Report</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaText}>Statement Period</Text>
              <Text style={styles.headerMetaValue}>{data.statementMonth}</Text>
              <Text style={[styles.headerMetaText, { marginTop: 6 }]}>Audit ID</Text>
              <Text style={styles.headerMetaValue}>{data.auditId}</Text>
            </View>
          </View>

          <View style={styles.headerDivider} />

          <Text style={styles.merchantName}>{data.merchant}</Text>
          <Text style={styles.merchantDetails}>
            {data.location}  {"\u00B7"}  MID: {data.mid}  {"\u00B7"}  Processor: {data.processor}
          </Text>

          <View style={styles.pillRow}>
            <Text style={styles.pill}>Vol: {data.volume}</Text>
            <Text style={[styles.pill, data.flags.nonPci > 0 && { backgroundColor: "#7F1D1D" }]}>
              {data.flags.nonPci} Non-PCI
            </Text>
            <Text style={[styles.pill, data.flags.downgrades > 0 && { backgroundColor: "#78350F" }]}>
              {data.flags.downgrades} Downgrades
            </Text>
            {scCount > 0 && (
              <Text style={[styles.pill, scOvercharges > 0 && { backgroundColor: "#5B21B6" }]}>
                {scCount} Svc Charges{scOvercharges > 0 ? ` (${scOvercharges} over)` : ""}
              </Text>
            )}
            {icCount > 0 && (
              <Text style={[styles.pill, { backgroundColor: "#1E3A5F" }]}>
                {icCount} Interchange
              </Text>
            )}
            <Text style={[styles.pill, styles.pillAccent]}>{data.status}</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.summaryCardAccent]}>
              <Text style={styles.summaryLabel}>Estimated Savings</Text>
              <Text style={[styles.summaryValue, styles.summaryValueGreen]}>
                {data.summary.discountSavings}
              </Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardWarn]}>
              <Text style={styles.summaryLabel}>Revenue Lost</Text>
              <Text style={[styles.summaryValue, styles.summaryValueRed]}>
                {data.summary.revenueLost}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{totalFindings}</Text>
              <Text style={styles.statLabel}>Total Findings</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: C.red }]}>{data.flags.nonPci}</Text>
              <Text style={styles.statLabel}>Non-PCI Flags</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: C.amber }]}>{data.flags.downgrades}</Text>
              <Text style={styles.statLabel}>Downgrades</Text>
            </View>
            {scCount > 0 && (
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: "#7C3AED" }]}>{scOvercharges}</Text>
                <Text style={styles.statLabel}>Svc Overcharges</Text>
              </View>
            )}
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{data.volume}</Text>
              <Text style={styles.statLabel}>Monthly Volume</Text>
            </View>
          </View>

          {/* Status banner */}
          <View style={[styles.banner, { borderColor: banner.border, backgroundColor: banner.bg }]}>
            <View style={[styles.bannerDot, { backgroundColor: banner.dot }]} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>{banner.title}</Text>
              <Text style={styles.bannerBody}>{banner.body}</Text>
            </View>
          </View>

          {/* Non-PCI findings */}
          {data.findings.nonPci.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: C.red }]} />
                <Text style={styles.sectionTitle}>Non-PCI Findings</Text>
                <Text style={styles.sectionCount}>
                  {data.findings.nonPci.length} item{data.findings.nonPci.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <Table rows={data.findings.nonPci} color="red" />
            </View>
          )}

          {/* Downgrade findings */}
          {data.findings.downgrades.length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: C.amber }]} />
                <Text style={styles.sectionTitle}>Downgrade Findings</Text>
                <Text style={styles.sectionCount}>
                  {data.findings.downgrades.length} item{data.findings.downgrades.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <Table rows={data.findings.downgrades} color="amber" />
            </View>
          )}

          {/* Service charge findings */}
          {(data.findings.serviceCharges ?? []).length > 0 && (
            <View>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: "#7C3AED" }]} />
                <Text style={styles.sectionTitle}>Service Charge Analysis</Text>
                <Text style={styles.sectionCount}>
                  {data.findings.serviceCharges!.length} fee{data.findings.serviceCharges!.length !== 1 ? "s" : ""}
                  {scOvercharges > 0 ? ` \u00B7 ${scOvercharges} overcharged` : ""}
                </Text>
              </View>
              <ServiceChargeTable rows={data.findings.serviceCharges!} />
            </View>
          )}

          {/* Interchange qualification lines */}
          {(data.findings.interchange ?? []).length > 0 && (
            <View break>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: "#2563EB" }]} />
                <Text style={styles.sectionTitle}>Interchange Qualification Lines</Text>
                <Text style={styles.sectionCount}>
                  {data.findings.interchange!.length} line{data.findings.interchange!.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <InterchangeTable rows={data.findings.interchange!} />
            </View>
          )}

          {/* Notes */}
          {data.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footerDivider} />
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            This report is generated from statement text extraction and rules-based classification.
            Figures are estimates and should be validated against processor pricing schedules,
            interchange tables, and merchant agreements. weAudit does not provide legal or tax advice.
          </Text>
          <Text style={styles.footerBrand}>
            weAudit  {"\u00B7"}  {data.statementMonth}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export type { AuditReportData };
