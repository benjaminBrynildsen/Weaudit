import type { AuditReportData } from "@/components/reports/AuditReportDocument";

type AuditSeed = {
  id: string;
  client: string;
  processor: string;
  statementMonth: string;
  mid: string;
  status: "Complete" | "Needs Review" | "In Progress";
  nonPci: number;
  downgrades: number;
  estRecovery: number;
};

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function makeMockAuditReport(seed?: Partial<AuditSeed>): AuditReportData {
  const s: AuditSeed = {
    id: seed?.id ?? "a-001",
    client: seed?.client ?? "Patriot Flooring Supplies",
    processor: seed?.processor ?? "CardConnect",
    statementMonth: seed?.statementMonth ?? "2025-12",
    mid: seed?.mid ?? "737191920880",
    status: seed?.status ?? "Needs Review",
    nonPci: seed?.nonPci ?? 1,
    downgrades: seed?.downgrades ?? 3,
    estRecovery: seed?.estRecovery ?? 319.15,
  };

  return {
    auditId: s.id,
    merchant: s.client,
    location: "Main location",
    statementMonth: s.statementMonth,
    processor: s.processor,
    mid: s.mid,
    volume: "$64,220.18",
    status: s.status,
    summary: {
      discountSavings: money(Math.max(0, s.estRecovery * 0.42)),
      revenueLost: money(Math.max(0, s.estRecovery)),
    },
    flags: {
      nonPci: s.nonPci,
      downgrades: s.downgrades,
    },
    findings: {
      nonPci: [
        {
          label: "Non‑PCI fee",
          count: Math.max(1, s.nonPci),
          volume: "$0",
          rate: "—",
          revenueLost: money(Math.max(25, s.estRecovery * 0.22)),
          reasons: "Fee classified as non‑PCI / compliance unrelated",
        },
      ],
      downgrades: [
        {
          label: "EIRF / Standard",
          count: Math.max(1, Math.ceil(s.downgrades * 0.6)),
          volume: "$12,480",
          rate: "+0.65%",
          chargedRate: "3.00%",
          correctedRate: "2.35%",
          revenueLost: money(Math.max(15, s.estRecovery * 0.28)),
          reasons: "Matched downgrade keywords; missing Level II/III data",
        },
        {
          label: "Non‑Qual / CNP",
          count: Math.max(1, Math.ceil(s.downgrades * 0.4)),
          volume: "$8,910",
          rate: "+0.80%",
          chargedRate: "3.15%",
          correctedRate: "2.35%",
          revenueLost: money(Math.max(10, s.estRecovery * 0.18)),
          reasons: "Card‑not‑present + qualification tier mismatch",
        },
      ],
    },
    notes: "For best results, compare flagged lines to the processor's pricing schedule and interchange categories.",
  };
}