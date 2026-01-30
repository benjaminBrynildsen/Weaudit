import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileScan,
  FileText,
  Flame,
  Highlighter,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ScanPhase = "idle" | "classify" | "extract" | "non_pci" | "downgrade" | "compute" | "complete";

type ScanStatus = "Idle" | "Scanning" | "Needs Review" | "Complete";

type ProcessorFamily = "fiserv_cardconnect_type1" | "fiserv_fiserv_type2" | "versapay_core";

type EvidenceRef = { page: number; box: { x: number; y: number; w: number; h: number } };

type LiveField = {
  label: string;
  value?: string;
  confidence?: number;
  page?: number;
  override?: string;
};

type NonPciRow = {
  id: string;
  raw: string;
  amount: string;
  ref: EvidenceRef;
  status: "Refund Candidate";
};

type DowngradeRow = {
  id: string;
  ofTrans: string;
  volume: string;
  raw: string;
  downgradeRate?: string;
  ifCorrected?: string;
  revenueLost?: string;
  feeActual?: string;
  ref: EvidenceRef;
  status?: "Needs Review";
};

function fmtPct(conf?: number) {
  if (conf === undefined) return "—";
  return `${Math.round(conf * 100)}%`;
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}`;
}

const processorFamilies: Array<{ value: ProcessorFamily; label: string; hint: string }> = [
  {
    value: "fiserv_cardconnect_type1",
    label: "Fiserv • CardConnect • Type 1",
    hint: "Fees section only, AMEX carve-out",
  },
  {
    value: "fiserv_fiserv_type2",
    label: "Fiserv • Fiserv • Type 2",
    hint: "Alternate totals layout",
  },
  {
    value: "versapay_core",
    label: "VersaPay • Core",
    hint: "Interchange lines grouped by program",
  },
];

const levelOptions = ["II", "III"] as const;

export default function Dashboard() {
  const [processorFamily, setProcessorFamily] = useState<ProcessorFamily>("fiserv_cardconnect_type1");
  const [level, setLevel] = useState<(typeof levelOptions)[number]>("II");

  const [status, setStatus] = useState<ScanStatus>("Idle");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);

  const [selectedPage, setSelectedPage] = useState(1);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const [fields, setFields] = useState<Record<string, LiveField>>({
    processor_detected: { label: "Processor (detected)" },
    company_dba: { label: "Company DBA" },
    mid: { label: "MID / Merchant #" },
    statement_period: { label: "Statement Period" },
    total_submitted_volume: { label: "Total Submitted Volume" },
    amex_volume: { label: "AMEX Volume" },
    monthly_volume_non_amex: { label: "Monthly Volume (Non-AMEX)" },
    total_fees: { label: "Total Fees" },
    amex_fees: { label: "AMEX Fees" },
    monthly_fees_non_amex: { label: "Monthly Fees (Non-AMEX)" },
    effective_rate: { label: "Effective Rate (Non-AMEX)" },
  });

  const [excludeAmex, setExcludeAmex] = useState(true);

  const [nonPci, setNonPci] = useState<NonPciRow[]>([]);
  const [downgrades, setDowngrades] = useState<DowngradeRow[]>([]);

  const isScanning = status === "Scanning";

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "classify":
        return "Phase A • Classify statement";
      case "extract":
        return "Phase B • Extract identity + totals";
      case "non_pci":
        return "Phase C • Non-PCI detection";
      case "downgrade":
        return "Phase D • Downgrade detection";
      case "compute":
        return "Phase E • Compute rollups";
      case "complete":
        return "Complete";
      default:
        return "Ready";
    }
  }, [phase]);

  const statusBadge = useMemo(() => {
    const base = "border";
    if (status === "Complete") return `${base} bg-emerald-500/10 text-emerald-600 border-emerald-500/20`;
    if (status === "Needs Review") return `${base} bg-amber-500/10 text-amber-700 border-amber-500/20`;
    if (status === "Scanning") return `${base} bg-sky-500/10 text-sky-600 border-sky-500/20`;
    return `${base} bg-secondary/30 text-muted-foreground border-border`;
  }, [status]);

  const nonPciTotal = useMemo(() => {
    const n = nonPci
      .map((r) => Number(String(r.amount).replace(/[^0-9.-]/g, "")))
      .filter((v) => !Number.isNaN(v))
      .reduce((a, b) => a + b, 0);
    return n;
  }, [nonPci]);

  const downgradeRollup = useMemo(() => {
    const vol = downgrades
      .map((r) => Number(String(r.volume).replace(/[^0-9.-]/g, "")))
      .filter((v) => !Number.isNaN(v))
      .reduce((a, b) => a + b, 0);

    const lost = downgrades
      .map((r) => Number(String(r.revenueLost ?? "").replace(/[^0-9.-]/g, "")))
      .filter((v) => !Number.isNaN(v))
      .reduce((a, b) => a + b, 0);

    return { rows: downgrades.length, volume: vol, revenueLost: lost };
  }, [downgrades]);

  function resetScan() {
    setStatus("Idle");
    setPhase("idle");
    setProgress(0);
    setSelectedEvidenceId(null);
    setSelectedPage(1);
    setExcludeAmex(true);

    setFields({
      processor_detected: { label: "Processor (detected)" },
      company_dba: { label: "Company DBA" },
      mid: { label: "MID / Merchant #" },
      statement_period: { label: "Statement Period" },
      total_submitted_volume: { label: "Total Submitted Volume" },
      amex_volume: { label: "AMEX Volume" },
      monthly_volume_non_amex: { label: "Monthly Volume (Non-AMEX)" },
      total_fees: { label: "Total Fees" },
      amex_fees: { label: "AMEX Fees" },
      monthly_fees_non_amex: { label: "Monthly Fees (Non-AMEX)" },
      effective_rate: { label: "Effective Rate (Non-AMEX)" },
    });

    setNonPci([]);
    setDowngrades([]);
  }

  function jumpToEvidence(ref: EvidenceRef, id?: string) {
    setSelectedPage(ref.page);
    if (id) setSelectedEvidenceId(id);
  }

  function startScan() {
    resetScan();
    setStatus("Scanning");
    setPhase("classify");
  }

  const timers = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    if (status !== "Scanning") return;

    const schedule = (ms: number, fn: () => void) => {
      const t = window.setTimeout(fn, ms);
      timers.current.push(t);
    };

    if (phase === "classify") {
      schedule(350, () => setProgress(8));
      schedule(650, () => {
        setFields((prev) => ({
          ...prev,
          processor_detected: {
            ...prev.processor_detected,
            value: processorFamily,
            confidence: 0.92,
            page: 1,
          },
        }));
      });
      schedule(1050, () => {
        setProgress(18);
        setPhase("extract");
      });
    }

    if (phase === "extract") {
      schedule(300, () => setProgress(26));
      schedule(650, () => {
        setFields((prev) => ({
          ...prev,
          company_dba: { ...prev.company_dba, value: "Acme Coffee Roasters", confidence: 0.88, page: 1 },
          mid: { ...prev.mid, value: "MID-0042187", confidence: 0.9, page: 1 },
          statement_period: { ...prev.statement_period, value: "2024-01-01 → 2024-01-31", confidence: 0.84, page: 1 },
          total_submitted_volume: { ...prev.total_submitted_volume, value: "$85,000.00", confidence: 0.86, page: 2 },
          amex_volume: { ...prev.amex_volume, value: "$9,400.00", confidence: 0.78, page: 2 },
          total_fees: { ...prev.total_fees, value: "$2,414.28", confidence: 0.83, page: 3 },
          amex_fees: { ...prev.amex_fees, value: "$312.16", confidence: 0.74, page: 3 },
        }));
      });
      schedule(980, () => {
        setProgress(40);
        setPhase("non_pci");
      });
    }

    if (phase === "non_pci") {
      schedule(260, () => setProgress(48));
      schedule(520, () => {
        const r1: NonPciRow = {
          id: uid("npc"),
          raw: "NON PCI COMPLIANCE FEE",
          amount: "$19.95",
          ref: { page: 4, box: { x: 10, y: 28, w: 54, h: 8 } },
          status: "Refund Candidate",
        };
        setNonPci((prev) => [...prev, r1]);
        setSelectedEvidenceId(r1.id);
        setSelectedPage(r1.ref.page);
      });
      schedule(900, () => {
        const r2: NonPciRow = {
          id: uid("npc"),
          raw: "NON-PCI PROGRAM FEE",
          amount: "$29.95",
          ref: { page: 5, box: { x: 12, y: 45, w: 52, h: 8 } },
          status: "Refund Candidate",
        };
        setNonPci((prev) => [...prev, r2]);
      });
      schedule(1200, () => {
        setProgress(62);
        setPhase("downgrade");
      });
    }

    if (phase === "downgrade") {
      schedule(250, () => setProgress(70));
      schedule(520, () => {
        const d1: DowngradeRow = {
          id: uid("dgr"),
          ofTrans: "124",
          volume: "$12,480.00",
          raw: "EIRF • VISA CPS/REWARDS 2",
          downgradeRate: "2.30%",
          ifCorrected: "1.80%",
          revenueLost: "$62.40",
          feeActual: "$287.04",
          ref: { page: 7, box: { x: 8, y: 22, w: 60, h: 10 } },
        };
        setDowngrades((prev) => [...prev, d1]);
        setSelectedEvidenceId(d1.id);
        setSelectedPage(d1.ref.page);
      });
      schedule(860, () => {
        const d2: DowngradeRow = {
          id: uid("dgr"),
          ofTrans: "39",
          volume: "$4,910.00",
          raw: "NON-QUAL • MC STANDARD",
          downgradeRate: "3.10%",
          ifCorrected: "2.10%",
          revenueLost: "$49.10",
          ref: { page: 7, box: { x: 10, y: 40, w: 58, h: 10 } },
          status: "Needs Review",
        };
        setDowngrades((prev) => [...prev, d2]);
        setStatus("Needs Review");
      });
      schedule(1200, () => {
        setProgress(86);
        setPhase("compute");
      });
    }

    if (phase === "compute") {
      schedule(300, () => setProgress(92));
      schedule(650, () => {
        const totalVol = 85000;
        const amexVol = 9400;
        const monthlyVol = totalVol - amexVol;
        const totalFees = 2414.28;
        const amexFees = 312.16;
        const monthlyFees = totalFees - amexFees;
        const oer = monthlyFees / monthlyVol;

        setFields((prev) => ({
          ...prev,
          monthly_volume_non_amex: {
            ...prev.monthly_volume_non_amex,
            value: `$${monthlyVol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            confidence: 0.76,
            page: 2,
          },
          monthly_fees_non_amex: {
            ...prev.monthly_fees_non_amex,
            value: `$${monthlyFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            confidence: 0.72,
            page: 3,
          },
          effective_rate: {
            ...prev.effective_rate,
            value: `${(oer * 100).toFixed(2)}%`,
            confidence: 0.68,
            page: 2,
          },
        }));
      });
      schedule(980, () => {
        setProgress(100);
        setPhase("complete");
        setStatus((s) => (s === "Needs Review" ? "Needs Review" : "Complete"));
      });
    }
  }, [phase, processorFamily, status]);

  const derived = useMemo(() => {
    const parseMoney = (s?: string) => {
      if (!s) return 0;
      const n = Number(String(s).replace(/[^0-9.-]/g, ""));
      return Number.isNaN(n) ? 0 : n;
    };

    const totalVol = parseMoney(fields.total_submitted_volume.value);
    const amexVol = parseMoney(fields.amex_volume.value);
    const totalFees = parseMoney(fields.total_fees.value);
    const amexFees = parseMoney(fields.amex_fees.value);

    const monthlyVol = Math.max(0, totalVol - (excludeAmex ? amexVol : 0));
    const monthlyFees = Math.max(0, totalFees - (excludeAmex ? amexFees : 0));

    const oer = monthlyVol > 0 ? monthlyFees / monthlyVol : 0;

    return { monthlyVol, monthlyFees, oer };
  }, [excludeAmex, fields]);

  useEffect(() => {
    if (status === "Idle") return;

    const vol = derived.monthlyVol;
    const fees = derived.monthlyFees;
    const oer = derived.oer;

    setFields((prev) => ({
      ...prev,
      monthly_volume_non_amex: {
        ...prev.monthly_volume_non_amex,
        value: vol
          ? `$${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : prev.monthly_volume_non_amex.value,
        confidence: prev.monthly_volume_non_amex.confidence ?? 0.7,
        page: prev.monthly_volume_non_amex.page ?? 2,
      },
      monthly_fees_non_amex: {
        ...prev.monthly_fees_non_amex,
        value: fees
          ? `$${fees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : prev.monthly_fees_non_amex.value,
        confidence: prev.monthly_fees_non_amex.confidence ?? 0.68,
        page: prev.monthly_fees_non_amex.page ?? 3,
      },
      effective_rate: {
        ...prev.effective_rate,
        value: oer ? `${(oer * 100).toFixed(2)}%` : prev.effective_rate.value,
        confidence: prev.effective_rate.confidence ?? 0.65,
        page: prev.effective_rate.page ?? 2,
      },
    }));
  }, [derived.monthlyFees, derived.monthlyVol, derived.oer, status]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <h1 data-testid="text-statements-title" className="text-2xl sm:text-3xl font-bold font-heading tracking-tight">
                  Statements Workspace
                </h1>
                <p data-testid="text-statements-subtitle" className="text-sm text-muted-foreground mt-1">
                  Data points appear live as each scan phase completes.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Processor family</Label>
                    <Select value={processorFamily} onValueChange={(v) => setProcessorFamily(v as ProcessorFamily)}>
                      <SelectTrigger data-testid="select-processor-family" className="h-10">
                        <SelectValue placeholder="Select processor family" />
                      </SelectTrigger>
                      <SelectContent>
                        {processorFamilies.map((p) => (
                          <SelectItem key={p.value} value={p.value} data-testid={`option-processor-family-${p.value}`}>
                            <div className="flex flex-col">
                              <span className="font-medium">{p.label}</span>
                              <span className="text-xs text-muted-foreground">{p.hint}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Level</Label>
                    <Select value={level} onValueChange={(v) => setLevel(v as any)}>
                      <SelectTrigger data-testid="select-level" className="h-10">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {levelOptions.map((l) => (
                          <SelectItem key={l} value={l} data-testid={`option-level-${l}`}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    data-testid="button-upload-pdf"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      startScan();
                    }}
                  >
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload PDF
                  </Button>

                  <Button
                    data-testid="button-start-scan"
                    className="h-10 shadow-sm"
                    onClick={startScan}
                    disabled={isScanning}
                  >
                    {isScanning ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    {isScanning ? "Scanning" : "Start scan"}
                  </Button>

                  <Button data-testid="button-reset-scan" variant="ghost" className="h-10" onClick={resetScan}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge data-testid="badge-scan-status" variant="outline" className={statusBadge}>
                  {status}
                </Badge>
                <Badge data-testid="badge-scan-phase" variant="outline" className="text-xs bg-secondary/30">
                  <FileScan className="w-3.5 h-3.5 mr-1" />
                  {phaseLabel}
                </Badge>
                <Badge data-testid="badge-scan-progress" variant="outline" className="text-xs text-muted-foreground">
                  {progress}%
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 h-10">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="input-statement-search"
                    className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Search extracted fields & descriptors…"
                  />
                </div>

                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" /> Non-PCI
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400" /> Downgrade
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <Card className="p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p data-testid="text-leftpanel-title" className="font-semibold">
                    Live Extracted Data
                  </p>
                  <p data-testid="text-leftpanel-subtitle" className="text-xs text-muted-foreground mt-1">
                    Value • confidence • page ref • override.
                  </p>
                </div>
                <Badge data-testid="badge-prototype" variant="outline" className="text-xs text-muted-foreground">
                  Prototype
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Identity</p>
                    <Badge data-testid="badge-identity" variant="outline" className="text-[11px] text-muted-foreground">
                      Phase B
                    </Badge>
                  </div>

                  {["processor_detected", "company_dba", "mid", "statement_period"].map((k) => {
                    const f = fields[k];
                    return (
                      <div key={k} className="rounded-lg border border-border bg-secondary/10 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p data-testid={`text-field-label-${k}`} className="text-[11px] text-muted-foreground">
                              {f.label}
                            </p>
                            <p data-testid={`text-field-value-${k}`} className="font-mono text-sm mt-1 truncate">
                              {f.override?.trim() ? f.override : f.value ?? "—"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p data-testid={`text-field-confidence-${k}`} className="text-[11px] text-muted-foreground">
                              {fmtPct(f.confidence)}
                            </p>
                            <button
                              data-testid={`button-field-jump-${k}`}
                              className="text-[11px] text-primary hover:underline"
                              onClick={() =>
                                f.page ? jumpToEvidence({ page: f.page, box: { x: 12, y: 20, w: 58, h: 8 } }, k) : null
                              }
                            >
                              {f.page ? `p.${f.page}` : ""}
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Input
                            data-testid={`input-field-override-${k}`}
                            value={f.override ?? ""}
                            onChange={(e) => setFields((prev) => ({ ...prev, [k]: { ...prev[k], override: e.target.value } }))}
                            placeholder="Override…"
                            className="h-9 font-mono"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Totals & rollups</p>
                    <Badge data-testid="badge-rollups" variant="outline" className="text-[11px] text-muted-foreground">
                      Phase E
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      "total_submitted_volume",
                      "amex_volume",
                      "monthly_volume_non_amex",
                      "total_fees",
                      "amex_fees",
                      "monthly_fees_non_amex",
                      "effective_rate",
                    ].map((k) => {
                      const f = fields[k];
                      return (
                        <div key={k} className="rounded-lg border border-border bg-secondary/10 p-3">
                          <p data-testid={`text-field-label-${k}`} className="text-[11px] text-muted-foreground">
                            {f.label}
                          </p>
                          <p data-testid={`text-field-value-${k}`} className="font-mono text-sm mt-1">
                            {f.override?.trim() ? f.override : f.value ?? "—"}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p data-testid={`text-field-confidence-${k}`} className="text-[11px] text-muted-foreground">
                              {fmtPct(f.confidence)}
                            </p>
                            <button
                              data-testid={`button-field-jump-${k}`}
                              className="text-[11px] text-primary hover:underline"
                              onClick={() =>
                                f.page ? jumpToEvidence({ page: f.page, box: { x: 10, y: 36, w: 62, h: 8 } }, k) : null
                              }
                            >
                              {f.page ? `p.${f.page}` : ""}
                            </button>
                          </div>
                          <div className="mt-2">
                            <Input
                              data-testid={`input-field-override-${k}`}
                              value={f.override ?? ""}
                              onChange={(e) => setFields((prev) => ({ ...prev, [k]: { ...prev[k], override: e.target.value } }))}
                              placeholder="Override…"
                              className="h-9 font-mono"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/10 p-3">
                    <div className="flex items-center justify-between">
                      <p data-testid="text-amex-toggle-label" className="text-xs font-semibold">
                        Exclude AmEx from effective rate
                      </p>
                      <button
                        data-testid="button-toggle-amex-exclusion"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setExcludeAmex((v) => !v)}
                      >
                        {excludeAmex ? "On" : "Off"}
                      </button>
                    </div>
                    <p data-testid="text-amex-toggle-hint" className="text-[11px] text-muted-foreground mt-1">
                      This toggles computed Monthly (Non-AMEX) volume/fees and OER.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Non-PCI fees</p>
                    <Badge
                      data-testid="badge-nonpci"
                      variant="outline"
                      className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20"
                    >
                      Phase C
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/10 p-3">
                    <div className="flex items-center justify-between">
                      <p data-testid="text-nonpci-count" className="text-xs font-semibold">
                        Items found
                      </p>
                      <p data-testid="text-nonpci-total" className="font-mono text-xs text-muted-foreground">
                        Total: ${nonPciTotal.toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {nonPci.length === 0 ? (
                        <p data-testid="text-nonpci-empty" className="text-xs text-muted-foreground">
                          {phase === "idle" ? "Start scan to detect NON-PCI lines." : "Searching for NON PCI / NON-PCI / NONPCI…"}
                        </p>
                      ) : (
                        nonPci.map((r) => (
                          <button
                            key={r.id}
                            data-testid={`row-nonpci-${r.id}`}
                            className="w-full text-left rounded-md border border-border bg-background/60 hover:bg-background transition-colors p-2"
                            onClick={() => jumpToEvidence(r.ref, r.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p data-testid={`text-nonpci-raw-${r.id}`} className="text-xs font-medium truncate">
                                  {r.raw}
                                </p>
                                <p data-testid={`text-nonpci-page-${r.id}`} className="text-[11px] text-muted-foreground mt-0.5">
                                  p.{r.ref.page}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p data-testid={`text-nonpci-amount-${r.id}`} className="font-mono text-xs">
                                  {r.amount}
                                </p>
                                <Badge
                                  data-testid={`badge-nonpci-flag-${r.id}`}
                                  variant="outline"
                                  className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 mt-1"
                                >
                                  Refund Candidate
                                </Badge>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Downgrade summary</p>
                    <Badge
                      data-testid="badge-downgrades"
                      variant="outline"
                      className="text-[11px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                    >
                      Phase D
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-secondary/10 p-3">
                      <p className="text-[11px] text-muted-foreground">Rows</p>
                      <p data-testid="text-downgrade-rows" className="font-mono text-sm mt-1">
                        {downgradeRollup.rows}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/10 p-3">
                      <p className="text-[11px] text-muted-foreground">Downgrade-coded volume</p>
                      <p data-testid="text-downgrade-volume" className="font-mono text-sm mt-1">
                        ${downgradeRollup.volume.toFixed(2)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-secondary/10 p-3">
                      <p className="text-[11px] text-muted-foreground">Revenue lost (est.)</p>
                      <p data-testid="text-downgrade-revenue-lost" className="font-mono text-sm mt-1">
                        ${downgradeRollup.revenueLost.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {status === "Needs Review" && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p data-testid="text-needs-review-title" className="text-xs font-semibold text-amber-800">
                                Needs review
                              </p>
                              <p data-testid="text-needs-review-body" className="text-[11px] text-amber-800/80 mt-1">
                                Keyword-triggered lines that aren’t in the library yet still appear now. Approve them to complete the scan.
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                data-testid="button-approve-review-items"
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => {
                                  setDowngrades((prev) => prev.map((r) => (r.status === "Needs Review" ? { ...r, status: undefined } : r)));
                                  setStatus("Complete");
                                  setPhase("complete");
                                  setProgress(100);
                                }}
                              >
                                Approve & Finish
                              </Button>
                              <Button
                                data-testid="button-dismiss-review"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setStatus("Complete");
                                  setPhase("complete");
                                  setProgress(100);
                                }}
                              >
                                Mark done
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="xl:col-span-6 space-y-6">
            <Card className="overflow-hidden shadow-sm">
              <div className="p-4 sm:p-5 border-b border-border bg-secondary/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p data-testid="text-pdf-title" className="font-semibold">
                      PDF Viewer
                    </p>
                    <p data-testid="text-pdf-subtitle" className="text-xs text-muted-foreground mt-1">
                      Outlines show detected evidence. Click a row to jump.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge data-testid="badge-page" variant="outline" className="font-mono text-xs">
                      Page {selectedPage} / 12
                    </Badge>
                    <Button
                      data-testid="button-prev-page"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      data-testid="button-next-page"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedPage((p) => Math.min(12, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>

              <div className="relative aspect-[3/4] bg-gradient-to-b from-background to-secondary/20">
                <div className="absolute inset-0 p-6">
                  <div className="h-full rounded-xl border border-border bg-card shadow-sm overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-10 border-b border-border bg-secondary/20 flex items-center justify-between px-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        <span data-testid="text-pdf-filename">Statement_2024-01.pdf</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          data-testid="badge-outline-red"
                          variant="outline"
                          className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20"
                        >
                          RED • Non-PCI
                        </Badge>
                        <Badge
                          data-testid="badge-outline-yellow"
                          variant="outline"
                          className="text-[10px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                        >
                          YELLOW • Downgrade
                        </Badge>
                      </div>
                    </div>

                    <div className="absolute inset-0 pt-12 p-4">
                      <div className="space-y-3 opacity-90">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="h-4 rounded bg-secondary/30" />
                        ))}
                        <div className="h-4 rounded bg-secondary/20 w-2/3" />
                        <div className="h-4 rounded bg-secondary/20 w-5/6" />
                        <div className="h-4 rounded bg-secondary/20 w-3/4" />
                      </div>

                      {nonPci
                        .filter((r) => r.ref.page === selectedPage)
                        .map((r) => (
                          <button
                            key={r.id}
                            data-testid={`outline-nonpci-${r.id}`}
                            className={`absolute rounded-md border-2 bg-red-500/10 transition-all ${
                              selectedEvidenceId === r.id
                                ? "border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
                                : "border-red-500/70"
                            }`}
                            style={{
                              left: `${r.ref.box.x}%`,
                              top: `${r.ref.box.y}%`,
                              width: `${r.ref.box.w}%`,
                              height: `${r.ref.box.h}%`,
                            }}
                            onClick={() => setSelectedEvidenceId(r.id)}
                            title={r.raw}
                          />
                        ))}

                      {downgrades
                        .filter((r) => r.ref.page === selectedPage)
                        .map((r) => (
                          <button
                            key={r.id}
                            data-testid={`outline-downgrade-${r.id}`}
                            className={`absolute rounded-md border-2 bg-yellow-400/10 transition-all ${
                              selectedEvidenceId === r.id
                                ? "border-yellow-500 shadow-[0_0_0_4px_rgba(234,179,8,0.18)]"
                                : "border-yellow-500/70"
                            }`}
                            style={{
                              left: `${r.ref.box.x}%`,
                              top: `${r.ref.box.y}%`,
                              width: `${r.ref.box.w}%`,
                              height: `${r.ref.box.h}%`,
                            }}
                            onClick={() => setSelectedEvidenceId(r.id)}
                            title={r.raw}
                          />
                        ))}

                      {status === "Idle" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-xl border border-border bg-background/80 backdrop-blur p-5 shadow-sm max-w-md">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p data-testid="text-pdf-empty-title" className="font-semibold">
                                  Ready to scan
                                </p>
                                <p data-testid="text-pdf-empty-body" className="text-sm text-muted-foreground mt-1">
                                  Click “Start scan” to simulate phased extraction and live evidence outlines.
                                </p>
                                <div className="mt-4 flex items-center gap-2">
                                  <Button data-testid="button-primary-start" onClick={startScan}>
                                    <Play className="w-4 h-4 mr-2" /> Start scan
                                  </Button>
                                  <Button data-testid="button-primary-upload" variant="outline" onClick={startScan}>
                                    <UploadCloud className="w-4 h-4 mr-2" /> Upload PDF
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-border bg-secondary/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Highlighter className="w-4 h-4" />
                    <span data-testid="text-evidence-hint">Click outlines or table rows to jump to the exact page.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge data-testid="badge-rulepack" variant="outline" className="text-xs text-muted-foreground">
                      Rule pack: {processorFamily}
                    </Badge>
                    <Badge data-testid="badge-level" variant="outline" className="text-xs text-muted-foreground">
                      Level {level}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="xl:col-span-3 space-y-6">
            <Card className="p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p data-testid="text-results-title" className="font-semibold">
                    Live Result Tables
                  </p>
                  <p data-testid="text-results-subtitle" className="text-xs text-muted-foreground mt-1">
                    Rows stream in during Phase C/D. Clicking a row jumps to evidence.
                  </p>
                </div>
                <Badge
                  data-testid="badge-live"
                  variant="outline"
                  className={
                    status === "Complete"
                      ? "text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "text-xs bg-sky-500/10 text-sky-600 border-sky-500/20"
                  }
                >
                  {status === "Complete" ? "Done" : "Live"}
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p data-testid="text-nonpci-table-title" className="text-xs font-semibold">
                      Non-PCI Fees Found
                    </p>
                    <Badge
                      data-testid="badge-nonpci-table"
                      variant="outline"
                      className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20"
                    >
                      RED
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-12 bg-secondary/20 text-[11px] text-muted-foreground px-3 py-2">
                      <div className="col-span-6">Raw descriptor</div>
                      <div className="col-span-3 text-right">Amount</div>
                      <div className="col-span-3 text-right">Page</div>
                    </div>
                    <div className="divide-y divide-border">
                      {nonPci.length === 0 ? (
                        <div className="p-3">
                          <p data-testid="text-nonpci-table-empty" className="text-xs text-muted-foreground">
                            {phase === "idle" ? "No rows yet." : "Streaming…"}
                          </p>
                        </div>
                      ) : (
                        nonPci.map((r) => (
                          <button
                            key={r.id}
                            data-testid={`table-nonpci-${r.id}`}
                            className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                            onClick={() => jumpToEvidence(r.ref, r.id)}
                          >
                            <div className="grid grid-cols-12 items-center">
                              <div className="col-span-6 min-w-0">
                                <p data-testid={`text-nonpci-table-raw-${r.id}`} className="text-xs font-medium truncate">
                                  {r.raw}
                                </p>
                                <Badge
                                  data-testid={`badge-nonpci-table-flag-${r.id}`}
                                  variant="outline"
                                  className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20 mt-1"
                                >
                                  Refund Candidate
                                </Badge>
                              </div>
                              <div className="col-span-3 text-right">
                                <p data-testid={`text-nonpci-table-amount-${r.id}`} className="font-mono text-xs">
                                  {r.amount}
                                </p>
                              </div>
                              <div className="col-span-3 text-right">
                                <p data-testid={`text-nonpci-table-page-${r.id}`} className="text-xs text-muted-foreground">
                                  p.{r.ref.page}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p data-testid="text-downgrade-table-title" className="text-xs font-semibold">
                      Downgrades Found (MADR)
                    </p>
                    <Badge
                      data-testid="badge-downgrade-table"
                      variant="outline"
                      className="text-[11px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                    >
                      YELLOW
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-12 bg-secondary/20 text-[11px] text-muted-foreground px-3 py-2">
                      <div className="col-span-2">#</div>
                      <div className="col-span-3 text-right">Volume</div>
                      <div className="col-span-5">Downgrade</div>
                      <div className="col-span-2 text-right">Lost</div>
                    </div>
                    <div className="divide-y divide-border">
                      {downgrades.length === 0 ? (
                        <div className="p-3">
                          <p data-testid="text-downgrade-table-empty" className="text-xs text-muted-foreground">
                            {phase === "idle" ? "No rows yet." : "Streaming…"}
                          </p>
                        </div>
                      ) : (
                        downgrades.map((r) => (
                          <button
                            key={r.id}
                            data-testid={`table-downgrade-${r.id}`}
                            className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                            onClick={() => jumpToEvidence(r.ref, r.id)}
                          >
                            <div className="grid grid-cols-12 items-center gap-2">
                              <div className="col-span-2">
                                <p data-testid={`text-downgrade-oftrans-${r.id}`} className="font-mono text-xs">
                                  {r.ofTrans}
                                </p>
                                <p data-testid={`text-downgrade-page-${r.id}`} className="text-[11px] text-muted-foreground mt-0.5">
                                  p.{r.ref.page}
                                </p>
                              </div>
                              <div className="col-span-3 text-right">
                                <p data-testid={`text-downgrade-volume-${r.id}`} className="font-mono text-xs">
                                  {r.volume}
                                </p>
                                {r.downgradeRate && (
                                  <p data-testid={`text-downgrade-rate-${r.id}`} className="text-[11px] text-muted-foreground mt-0.5">
                                    {r.downgradeRate} → {r.ifCorrected}
                                  </p>
                                )}
                              </div>
                              <div className="col-span-5 min-w-0">
                                <p data-testid={`text-downgrade-raw-${r.id}`} className="text-xs font-medium truncate">
                                  {r.raw}
                                </p>
                                {r.status === "Needs Review" && (
                                  <Badge
                                    data-testid={`badge-downgrade-needs-review-${r.id}`}
                                    variant="outline"
                                    className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20 mt-1"
                                  >
                                    Needs Review
                                  </Badge>
                                )}
                              </div>
                              <div className="col-span-2 text-right">
                                <p data-testid={`text-downgrade-lost-${r.id}`} className="font-mono text-xs">
                                  {r.revenueLost ?? "—"}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/10 p-3">
                    <div className="flex items-center justify-between">
                      <p data-testid="text-queue-hint" className="text-xs font-semibold">
                        Unknown handling (prototype)
                      </p>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p data-testid="text-queue-body" className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      If keyword-triggered but not in the library: show the row now as “Needs Review” and enqueue for later approval.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/10 p-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    <p data-testid="text-ruleset-note" className="text-xs text-muted-foreground">
                      All logic is keyed by <span className="font-mono">processor_family</span>. No cross-processor bidding.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/10 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p data-testid="text-footer-title" className="font-semibold">
                  Live scan phases
                </p>
                <p data-testid="text-footer-body" className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Phase A locates sections using processor rules. Phase B fills identity + totals. Phase C flags NON-PCI. Phase D matches downgrade patterns +
                  heuristics. Phase E computes rollups.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                data-testid="button-simulate-complete"
                variant="outline"
                onClick={() => {
                  setStatus("Complete");
                  setPhase("complete");
                  setProgress(100);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark complete
              </Button>
              <Button
                data-testid="button-review-results"
                variant="secondary"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Review results
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
