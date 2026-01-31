import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type FindingRow = {
  label: string;
  count: number;
  volume: string;
  rate: string;
  revenueLost: string;
  reasons: string;
};

type AuditReportData = {
  auditId: string;
  merchant: string;
  location: string;
  statementMonth: string;
  processor: string;
  mid: string;
  volume: string;
  status: "Complete" | "Needs Review" | "In Progress";
  summary: {
    discountSavings: string;
    revenueLost: string;
  };
  flags: {
    nonPci: number;
    downgrades: number;
  };
  findings: {
    nonPci: FindingRow[];
    downgrades: FindingRow[];
  };
  notes?: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0b1220",
  },
  header: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#0b1220",
    color: "#ffffff",
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  brand: { fontSize: 14, fontWeight: 700 },
  meta: { fontSize: 9, opacity: 0.85 },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    fontSize: 9,
  },
  section: { marginTop: 16 },
  h2: { fontSize: 11, fontWeight: 700, marginBottom: 8 },
  grid2: { flexDirection: "row", gap: 10 },
  card: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: "#E6E9F2",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  label: { fontSize: 9, color: "#536079" },
  value: { fontSize: 12, fontWeight: 700, marginTop: 3 },
  banner: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  bannerTitle: { fontSize: 10, fontWeight: 700 },
  bannerBody: { marginTop: 2, fontSize: 9, color: "#31415f" },
  table: {
    borderWidth: 1,
    borderColor: "#E6E9F2",
    borderRadius: 12,
    overflow: "hidden",
  },
  tr: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#E6E9F2",
  },
  th: {
    backgroundColor: "#F7F8FB",
    borderTopWidth: 0,
  },
  cell: { padding: 8 },
  c1: { width: "22%" },
  c2: { width: "10%", textAlign: "right" },
  c3: { width: "14%", textAlign: "right" },
  c4: { width: "12%", textAlign: "right" },
  c5: { width: "14%", textAlign: "right" },
  c6: { width: "28%" },
  thText: { fontSize: 9, fontWeight: 700, color: "#23314a" },
  tdText: { fontSize: 9, color: "#0b1220" },
  foot: { marginTop: 14, fontSize: 8, color: "#5b677d", lineHeight: 1.35 },
  divider: { marginTop: 10, height: 1, backgroundColor: "#E6E9F2" },
});

function statusToBanner(status: AuditReportData["status"], nonPci: number, downgrades: number) {
  if (status === "In Progress") {
    return { border: "#E6E9F2", bg: "#F7F8FB", title: "Audit in progress", body: "Results may be partial until the scan completes." };
  }
  if (nonPci > 0) {
    return {
      border: "#FCA5A5",
      bg: "#FEF2F2",
      title: "NON‑PCI fees detected (RED)",
      body: "These items are flagged as non‑PCI related charges or non‑compliant fee structures.",
    };
  }
  if (downgrades > 0) {
    return {
      border: "#FDE68A",
      bg: "#FFFBEB",
      title: "Downgrades detected (YELLOW)",
      body: "These items are flagged as downgrade/qualification issues that typically increase effective rates.",
    };
  }
  return { border: "#BBF7D0", bg: "#F0FDF4", title: "No high‑severity flags detected", body: "No non‑PCI fees were flagged in this statement period." };
}

function Table({ rows }: { rows: FindingRow[] }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.th]}>
        <View style={[styles.cell, styles.c1]}>
          <Text style={styles.thText}>Finding</Text>
        </View>
        <View style={[styles.cell, styles.c2]}>
          <Text style={styles.thText}>#</Text>
        </View>
        <View style={[styles.cell, styles.c3]}>
          <Text style={styles.thText}>Volume</Text>
        </View>
        <View style={[styles.cell, styles.c4]}>
          <Text style={styles.thText}>Rate</Text>
        </View>
        <View style={[styles.cell, styles.c5]}>
          <Text style={styles.thText}>Lost</Text>
        </View>
        <View style={[styles.cell, styles.c6]}>
          <Text style={styles.thText}>Reason</Text>
        </View>
      </View>

      {rows.map((r, idx) => (
        <View key={`${r.label}-${idx}`} style={styles.tr}>
          <View style={[styles.cell, styles.c1]}>
            <Text style={styles.tdText}>{r.label}</Text>
          </View>
          <View style={[styles.cell, styles.c2]}>
            <Text style={styles.tdText}>{r.count}</Text>
          </View>
          <View style={[styles.cell, styles.c3]}>
            <Text style={styles.tdText}>{r.volume}</Text>
          </View>
          <View style={[styles.cell, styles.c4]}>
            <Text style={styles.tdText}>{r.rate}</Text>
          </View>
          <View style={[styles.cell, styles.c5]}>
            <Text style={styles.tdText}>{r.revenueLost}</Text>
          </View>
          <View style={[styles.cell, styles.c6]}>
            <Text style={styles.tdText}>{r.reasons}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AuditReportDocument({ data }: { data: AuditReportData }) {
  const banner = statusToBanner(data.status, data.flags.nonPci, data.flags.downgrades);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>AutoAudit</Text>
            <Text style={styles.meta}>Audit Report • {data.statementMonth} • {data.auditId}</Text>
          </View>

          <Text style={styles.meta}>
            {data.merchant} • {data.location} • MID {data.mid} • Processor {data.processor}
          </Text>

          <View style={styles.pillRow}>
            <Text style={styles.pill}>Volume: {data.volume}</Text>
            <Text style={styles.pill}>Flags: {data.flags.nonPci} red • {data.flags.downgrades} yellow</Text>
            <Text style={styles.pill}>Status: {data.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Summary</Text>
          <View style={styles.grid2}>
            <View style={styles.card}>
              <Text style={styles.label}>Discount savings (est.)</Text>
              <Text style={styles.value}>{data.summary.discountSavings}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Revenue lost (est.)</Text>
              <Text style={styles.value}>{data.summary.revenueLost}</Text>
            </View>
          </View>

          <View style={[styles.banner, { borderColor: banner.border, backgroundColor: banner.bg }]}>
            <Text style={styles.bannerTitle}>{banner.title}</Text>
            <Text style={styles.bannerBody}>{banner.body}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Findings — NON‑PCI (RED)</Text>
          <Table rows={data.findings.nonPci} />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Findings — Downgrades (YELLOW)</Text>
          <Table rows={data.findings.downgrades} />
        </View>

        <View style={styles.divider} />
        <Text style={styles.foot}>
          Disclaimer: This report is generated from statement text extraction and rules-based classification. Figures are estimates and should be validated against
          processor pricing schedules, interchange tables, and merchant agreements. AutoAudit does not provide legal or tax advice.
        </Text>
        {data.notes ? <Text style={styles.foot}>Notes: {data.notes}</Text> : null}
      </Page>
    </Document>
  );
}
export type { AuditReportData };