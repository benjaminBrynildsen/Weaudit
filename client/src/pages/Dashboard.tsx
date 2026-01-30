import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type ProcessorFamily = "adymo" | "worldpay" | "fispay" | "merchantlink";

type ScanPhase = "idle" | "classify" | "extract" | "non_pci" | "downgrade" | "compute" | "complete";

type ScanStatus = "Idle" | "Scanning" | "Needs Review" | "Complete";

type FieldKey =
  | "processor_detected"
  | "company_dba"
  | "mid"
  | "statement_period"
  | "total_submitted_volume"
  | "amex_volume"
  | "monthly_volume_non_amex"
  | "total_fees"
  | "amex_fees"
  | "monthly_fees_non_amex"
  | "effective_rate";

type FieldValue = {
  label: string;
  value?: string;
  confidence?: number;
  page?: number;
  override?: string;
};

type EvidenceRef = { page: number; box: { x: number; y: number; w: number; h: number } };

type NonPciRow = {
  id: string;
  raw: string;
  amount: string;
  ref: EvidenceRef;
  status?: "Refund Candidate";
};

type DowngradeRow = {
  id: string;
  ofTrans: string;
  volume: string;
  raw: string;
  downgradeRate?: string;
  ifCorrected?: string;
  revenueLost?: string;
  ref: EvidenceRef;
  flagged?: boolean;
  flagReason?: string;
};

type ReviewItem = {
  id: string;
  kind: "downgrade";
  raw: string;
  page: number;
  note: string;
  createdAt: number;
  processorFamily: ProcessorFamily;
};

const processorFamilies: { value: ProcessorFamily; label: string; hint: string }[] = [
  { value: "adymo", label: "Adymo family", hint: "Common ECP formats, assessment + pass-through" },
  { value: "worldpay", label: "Worldpay family", hint: "Tier + interchange descriptors" },
  { value: "fispay", label: "FIS Pay family", hint: "DDA funding + fee sections" },
  { value: "merchantlink", label: "MerchantLink family", hint: "Statement batching + addenda" },
];

const levelOptions = ["I", "II", "III"] as const;

function fmtPct(n?: number) {
  if (typeof n !== "number") return "—";
  return `${Math.round(n * 100)}%`;
}

function parseMoney(input?: string) {
  if (!input) return 0;
  const s = input.replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export default function Dashboard() {
  const [processorFamily, setProcessorFamily] = useState<ProcessorFamily>("adymo");
  const [level, setLevel] = useState<(typeof levelOptions)[number]>("II");

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [status, setStatus] = useState<ScanStatus>("Idle");
  const [progress, setProgress] = useState<number>(0);

  const [excludeAmex, setExcludeAmex] = useState<boolean>(true);

  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const baseFields: Record<FieldKey, FieldValue> = {
    processor_detected: { label: "Processor (detected)" },
    company_dba: { label: "DBA" },
    mid: { label: "MID / Merchant #" },
    statement_period: { label: "Statement Period" },
    total_submitted_volume: { label: "Total Submitted Volume" },
    amex_volume: { label: "AMEX Volume" },
    monthly_volume_non_amex: { label: "Monthly Volume (Non-AMEX)" },
    total_fees: { label: "Total Fees" },
    amex_fees: { label: "AMEX Fees" },
    monthly_fees_non_amex: { label: "Monthly Fees (Non-AMEX)" },
    effective_rate: { label: "Effective Rate (OER)" },
  };

  const [fields, setFields] = useState<Record<FieldKey, FieldValue>>(() => ({
    ...baseFields,
    processor_detected: { ...baseFields.processor_detected, value: "—", confidence: 0.0, page: 1 },
    company_dba: { ...baseFields.company_dba, value: "—", confidence: 0.0, page: 1 },
    mid: { ...baseFields.mid, value: "—", confidence: 0.0, page: 1 },
    statement_period: { ...baseFields.statement_period, value: "—", confidence: 0.0, page: 1 },
    total_submitted_volume: { ...baseFields.total_submitted_volume, value: "—", confidence: 0.0, page: 1 },
    amex_volume: { ...baseFields.amex_volume, value: "—", confidence: 0.0, page: 2 },
    monthly_volume_non_amex: { ...baseFields.monthly_volume_non_amex, value: "—", confidence: 0.0, page: 2 },
    total_fees: { ...baseFields.total_fees, value: "—", confidence: 0.0, page: 3 },
    amex_fees: { ...baseFields.amex_fees, value: "—", confidence: 0.0, page: 3 },
    monthly_fees_non_amex: { ...baseFields.monthly_fees_non_amex, value: "—", confidence: 0.0, page: 3 },
    effective_rate: { ...baseFields.effective_rate, value: "—", confidence: 0.0, page: 2 },
  }));

  const [nonPci, setNonPci] = useState<NonPciRow[]>([]);
  const [downgrades, setDowngrades] = useState<DowngradeRow[]>([]);

  const timers = useRef<number[]>([]);

  const isScanning = status === "Scanning";

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "idle":
        return "Idle";
      case "classify":
        return "Classify";
      case "extract":
        return "Extract";
      case "non_pci":
        return "Non-PCI";
      case "downgrade":
        return "Downgrade";
      case "compute":
        return "Compute";
      case "complete":
        return "Complete";
      default:
        return phase;
    }
  }, [phase]);

  const statusBadge = useMemo(() => {
    if (status === "Complete") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (status === "Needs Review") return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    if (status === "Scanning") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    return "text-muted-foreground";
  }, [status]);

  const nonPciTotal = useMemo(() => nonPci.reduce((acc, r) => acc + parseMoney(r.amount), 0), [nonPci]);

  const downgradeRollup = useMemo(() => {
    const rows = downgrades.length;
    const volume = downgrades.reduce((acc, r) => acc + parseMoney(r.volume), 0);
    const revenueLost = downgrades.reduce((acc, r) => acc + parseMoney(r.revenueLost), 0);
    return { rows, volume, revenueLost };
  }, [downgrades]);

  const derived = useMemo(() => {
    const totalVol = parseMoney(
      fields.total_submitted_volume.override?.trim() ? fields.total_submitted_volume.override : fields.total_submitted_volume.value,
    );
    const amexVol = parseMoney(fields.amex_volume.override?.trim() ? fields.amex_volume.override : fields.amex_volume.value);
    const totalFees = parseMoney(fields.total_fees.override?.trim() ? fields.total_fees.override : fields.total_fees.value);
    const amexFees = parseMoney(fields.amex_fees.override?.trim() ? fields.amex_fees.override : fields.amex_fees.value);

    const monthlyVol = excludeAmex ? Math.max(0, totalVol - amexVol) : totalVol;
    const monthlyFees = excludeAmex ? Math.max(0, totalFees - amexFees) : totalFees;
    const oer = monthlyVol > 0 ? monthlyFees / monthlyVol : 0;

    return { totalVol, amexVol, totalFees, amexFees, monthlyVol, monthlyFees, oer };
  }, [excludeAmex, fields]);

  useEffect(() => {
    setFields((prev) => {
      const vol = derived.monthlyVol;
      const fees = derived.monthlyFees;
      const oer = derived.oer;
      return {
        ...prev,
        monthly_volume_non_amex: {
          ...prev.monthly_volume_non_amex,
          value: vol ? `$${vol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : prev.monthly_volume_non_amex.value,
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
      };
    });
  }, [derived.monthlyFees, derived.monthlyVol, derived.oer]);

  function jumpToEvidence(ref: EvidenceRef, id?: string) {
    setSelectedPage(ref.page);
    if (id) setSelectedEvidenceId(id);
  }

  function resetScan() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPhase("idle");
    setStatus("Idle");
    setProgress(0);
    setSelectedPage(1);
    setSelectedEvidenceId(null);
    setNonPci([]);
    setDowngrades([]);
    setFields((prev) => {
      const next: Record<FieldKey, FieldValue> = { ...prev };
      (Object.keys(baseFields) as FieldKey[]).forEach((k) => {
        next[k] = { ...baseFields[k], value: "—", confidence: 0.0, page: prev[k].page, override: "" };
      });
      return next;
    });
  }

  function startScan() {
    resetScan();
    setStatus("Scanning");
    setPhase("classify");

    const schedule = (ms: number, fn: () => void) => {
      const t = window.setTimeout(fn, ms);
      timers.current.push(t);
    };

    schedule(500, () => {
      setProgress(18);
      setPhase("extract");
      setFields((prev) => ({
        ...prev,
        processor_detected: { ...prev.processor_detected, value: "commercecontrol_statement", confidence: 0.9, page: 1 },
        company_dba: { ...prev.company_dba, value: "PATRIOT FLOORING SUPPLIE", confidence: 0.86, page: 1 },
        mid: { ...prev.mid, value: "737191920880", confidence: 0.95, page: 1 },
        statement_period: { ...prev.statement_period, value: "12/01/25 – 12/31/25", confidence: 0.94, page: 1 },
        total_submitted_volume: { ...prev.total_submitted_volume, value: "$289,467.20", confidence: 0.92, page: 1 },
        amex_volume: { ...prev.amex_volume, value: "$224,793.00", confidence: 0.9, page: 2 },
        total_fees: { ...prev.total_fees, value: "$2,096.96", confidence: 0.9, page: 1 },
      }));
    });

    schedule(1000, () => {
      setProgress(42);
      setPhase("non_pci");
      const r1: NonPciRow = {
        id: uid("npc"),
        raw: "NON PCI COMPLIANCE FEE",
        amount: "$19.95",
        ref: { page: 4, box: { x: 10, y: 28, w: 54, h: 8 } },
        status: "Refund Candidate",
      };
      setNonPci([r1]);
      setSelectedEvidenceId(r1.id);
      setSelectedPage(4);
    });

    schedule(1500, () => {
      setProgress(62);
      setPhase("downgrade");
      const d1: DowngradeRow = {
        id: uid("dgr"),
        ofTrans: "—",
        volume: "$32,324.71",
        raw: "VISA ASSESSMENT FEE CR .001400 TIMES $32,324.71",
        revenueLost: "—",
        ref: { page: 3, box: { x: 8, y: 56, w: 78, h: 9 } },
        flagged: true,
        flagReason: "Keyword-triggered: not in rule pack",
      };
      setDowngrades([d1]);
    });

    schedule(2100, () => {
      setProgress(86);
      setPhase("compute");
      setFields((prev) => ({
        ...prev,
        amex_fees: { ...prev.amex_fees, value: "—", confidence: 0.35, page: 3 },
      }));
    });

    schedule(2600, () => {
      setProgress(100);
      setPhase("complete");
      setStatus("Complete");
    });
  }

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

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
                  <Button data-testid="button-upload-pdf" variant="outline" className="h-10" onClick={startScan}>
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Upload PDF
                  </Button>

                  <Button data-testid="button-start-scan" className="h-10 shadow-sm" onClick={startScan} disabled={isScanning}>
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

        <Card className="p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p data-testid="text-live-strip-title" className="font-semibold">
                Live Results
              </p>
              <p data-testid="text-live-strip-subtitle" className="text-xs text-muted-foreground mt-1">
                Thin, full-width stream of key rows. Click a row to jump to evidence.
              </p>
            </div>
            <Badge
              data-testid="badge-live-strip"
              variant="outline"
              className={
                status === "Complete"
                  ? "text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : status === "Needs Review"
                    ? "text-xs bg-amber-500/10 text-amber-700 border-amber-500/20"
                    : "text-xs bg-sky-500/10 text-sky-600 border-sky-500/20"
              }
            >
              {status === "Complete" ? "Done" : status === "Needs Review" ? "Review" : "Live"}
            </Badge>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between bg-secondary/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge data-testid="badge-live-strip-nonpci" variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20">
                    Non-PCI
                  </Badge>
                  <p data-testid="text-live-strip-nonpci-title" className="text-xs font-semibold truncate">
                    Refund candidates
                  </p>
                </div>
                <p data-testid="text-live-strip-nonpci-total" className="font-mono text-xs text-muted-foreground">
                  ${nonPciTotal.toFixed(2)}
                </p>
              </div>

              <div className="divide-y divide-border max-h-[150px] overflow-auto">
                {nonPci.length === 0 ? (
                  <div className="p-3">
                    <p data-testid="text-live-strip-nonpci-empty" className="text-xs text-muted-foreground">
                      {phase === "idle" ? "No rows yet." : "Streaming…"}
                    </p>
                  </div>
                ) : (
                  nonPci.map((r) => (
                    <button
                      key={r.id}
                      data-testid={`strip-nonpci-${r.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                      onClick={() => jumpToEvidence(r.ref, r.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p data-testid={`text-strip-nonpci-raw-${r.id}`} className="text-xs font-medium truncate">
                            {r.raw}
                          </p>
                          <p data-testid={`text-strip-nonpci-page-${r.id}`} className="text-[11px] text-muted-foreground mt-0.5">
                            p.{r.ref.page}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p data-testid={`text-strip-nonpci-amount-${r.id}`} className="font-mono text-xs">
                            {r.amount}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between bg-secondary/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    data-testid="badge-live-strip-downgrade"
                    variant="outline"
                    className="text-[11px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                  >
                    Downgrades
                  </Badge>
                  <p data-testid="text-live-strip-downgrade-title" className="text-xs font-semibold truncate">
                    MADR-style stream
                  </p>
                </div>
                <p data-testid="text-live-strip-downgrade-count" className="text-xs text-muted-foreground">
                  {downgrades.length} rows
                </p>
              </div>

              <div className="divide-y divide-border max-h-[150px] overflow-auto">
                {downgrades.length === 0 ? (
                  <div className="p-3">
                    <p data-testid="text-live-strip-downgrade-empty" className="text-xs text-muted-foreground">
                      {phase === "idle" ? "No rows yet." : "Streaming…"}
                    </p>
                  </div>
                ) : (
                  downgrades.map((r) => (
                    <button
                      key={r.id}
                      data-testid={`strip-downgrade-${r.id}`}
                      className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                      onClick={() => jumpToEvidence(r.ref, r.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p data-testid={`text-strip-downgrade-raw-${r.id}`} className="text-xs font-medium truncate">
                            {r.raw}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p data-testid={`text-strip-downgrade-page-${r.id}`} className="text-[11px] text-muted-foreground">
                              p.{r.ref.page}
                            </p>
                            {r.flagged && (
                              <Badge
                                data-testid={`badge-strip-downgrade-flag-${r.id}`}
                                variant="outline"
                                className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                              >
                                Flag
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p data-testid={`text-strip-downgrade-volume-${r.id}`} className="font-mono text-xs">
                            {r.volume}
                          </p>
                          <p data-testid={`text-strip-downgrade-lost-${r.id}`} className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            {r.revenueLost ?? "—"}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-6">
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
                    const key = k as FieldKey;
                    const f = fields[key];
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
                            <button
                              data-testid={`button-field-jump-${k}`}
                              className="text-[11px] text-primary hover:underline"
                              onClick={() => (f.page ? jumpToEvidence({ page: f.page, box: { x: 12, y: 20, w: 58, h: 8 } }, k) : null)}
                            >
                              {f.page ? `p.${f.page}` : ""}
                            </button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Input
                            data-testid={`input-field-override-${k}`}
                            value={f.override ?? ""}
                            onChange={(e) => setFields((prev) => ({ ...prev, [key]: { ...prev[key], override: e.target.value } }))}
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
                      const key = k as FieldKey;
                      const f = fields[key];
                      return (
                        <div key={k} className="rounded-lg border border-border bg-secondary/10 p-3">
                          <p data-testid={`text-field-label-${k}`} className="text-[11px] text-muted-foreground">
                            {f.label}
                          </p>
                          <p data-testid={`text-field-value-${k}`} className="font-mono text-sm mt-1">
                            {f.override?.trim() ? f.override : f.value ?? "—"}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <button
                              data-testid={`button-field-jump-${k}`}
                              className="text-[11px] text-primary hover:underline"
                              onClick={() => (f.page ? jumpToEvidence({ page: f.page, box: { x: 10, y: 36, w: 62, h: 8 } }, k) : null)}
                            >
                              {f.page ? `p.${f.page}` : ""}
                            </button>
                          </div>
                          <div className="mt-2">
                            <Input
                              data-testid={`input-field-override-${k}`}
                              value={f.override ?? ""}
                              onChange={(e) => setFields((prev) => ({ ...prev, [key]: { ...prev[key], override: e.target.value } }))}
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
                    <Badge data-testid="badge-nonpci" variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20">
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

                  {phase === "complete" && downgrades.some((d) => d.flagged) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p data-testid="text-review-before-saving-title" className="text-xs font-semibold text-amber-800">
                                Review before saving
                              </p>
                              <p data-testid="text-review-before-saving-body" className="text-[11px] text-amber-800/80 mt-1">
                                We found {downgrades.filter((d) => d.flagged).length} potential new downgrade line(s). Finish the scan, then review flagged rows before saving.
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                data-testid="button-open-review"
                                size="sm"
                                className="h-8 bg-amber-700 hover:bg-amber-800 text-white"
                                onClick={() => {
                                  window.location.href = "/review";
                                }}
                              >
                                Open review
                              </Button>
                              <Button
                                data-testid="button-mark-reviewed-later"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                Later
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

          <div className="xl:col-span-8 space-y-6">
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
                    <Button data-testid="button-prev-page" size="sm" variant="outline" onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}>
                      Prev
                    </Button>
                    <Button data-testid="button-next-page" size="sm" variant="outline" onClick={() => setSelectedPage((p) => Math.min(12, p + 1))}>
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

                    <div className="absolute inset-0 pt-10 p-4">
                      <div className="h-full rounded-lg bg-background/70 border border-border relative overflow-hidden">
                        <div
                          className="absolute inset-0 opacity-[0.18]"
                          style={{
                            backgroundImage:
                              "linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0)), radial-gradient(circle at 20% 25%, rgba(0,0,0,0.06), transparent 60%)",
                          }}
                        />

                        {nonPci
                          .filter((r) => r.ref.page === selectedPage)
                          .map((r) => (
                            <button
                              key={r.id}
                              data-testid={`outline-nonpci-${r.id}`}
                              className={`absolute border-2 rounded-md bg-red-500/5 ${
                                selectedEvidenceId === r.id
                                  ? "border-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.18)]"
                                  : "border-red-500/70"
                              }`}
                              style={{ left: `${r.ref.box.x}%`, top: `${r.ref.box.y}%`, width: `${r.ref.box.w}%`, height: `${r.ref.box.h}%` }}
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
                              className={`absolute border-2 rounded-md bg-yellow-400/10 ${
                                selectedEvidenceId === r.id
                                  ? "border-yellow-500 shadow-[0_0_0_4px_rgba(234,179,8,0.18)]"
                                  : "border-yellow-500/70"
                              }`}
                              style={{ left: `${r.ref.box.x}%`, top: `${r.ref.box.y}%`, width: `${r.ref.box.w}%`, height: `${r.ref.box.h}%` }}
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
