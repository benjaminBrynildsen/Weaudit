import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Expand,
  FileScan,
  FileText,
  Flame,
  Highlighter,
  Loader2,
  Pause,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  UploadCloud,
  X,
} from "lucide-react";
import { useUploadStatement, useTriggerScan, useAuditStatus, useAudit, useFindings, useUpdateFinding, useCompanies, useUpdateCompany } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import AuditCelebration from "@/components/AuditCelebration";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  needsReview?: boolean;
  reviewReason?: string;
  page?: number;
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

export default function Dashboard() {
  const [processorFamily, setProcessorFamily] = useState<ProcessorFamily>("adymo");
  const [level, setLevel] = useState<(typeof levelOptions)[number]>("II");

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [status, setStatus] = useState<ScanStatus>("Idle");
  const [progress, setProgress] = useState<number>(0);

  const [excludeAmex, setExcludeAmex] = useState<boolean>(true);

  const [currentAuditId, setCurrentAuditId] = useState<string | undefined>(undefined);

  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedDowngrade, setSelectedDowngrade] = useState<DowngradeRow | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const celebratedAuditRef = useRef<string | null>(null);

  const baseFields: Record<FieldKey, FieldValue> = {
    processor_detected: { label: "Processor (detected)" },
    company_dba: { label: "DBA" },
    mid: { label: "MID / Merchant #" },
    statement_period: { label: "Statement Period" },
    total_submitted_volume: { label: "Total Submitted Volume" },
    amex_volume: { label: "AMEX Volume" },
    monthly_volume_non_amex: { label: "Processing Volume" },
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
  const [reviewDowngrades, setReviewDowngrades] = useState<DowngradeRow[]>([]);
  const [downgradesExpanded, setDowngradesExpanded] = useState(false);

  const isScanning = status === "Scanning";

  // Helper function to determine parser type from processor name
  const getParserType = useCallback((processor?: string): string => {
    if (!processor) return "Generic";
    if (/fiserv|first data/i.test(processor)) return "Fiserv";
    if (/cardconnect/i.test(processor)) return "CardConnect";
    return "Generic";
  }, []);

  // API hooks
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const uploadMutation = useUploadStatement();
  const triggerScan = useTriggerScan();
  const { data: auditStatusData } = useAuditStatus(currentAuditId, isScanning);
  const { data: auditData } = useAudit(currentAuditId);
  const { data: findingsData } = useFindings(currentAuditId);
  const updateFindingMutation = useUpdateFinding();
  const { data: companiesData } = useCompanies();
  const updateCompanyMutation = useUpdateCompany();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [levelMismatch, setLevelMismatch] = useState<{
    companyName: string;
    companyId: string;
    companyLevel: string;
    auditLevel: string;
  } | null>(null);
  const levelMismatchCheckedRef = useRef<string | null>(null);

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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create blob URL so the PDF viewer can display the file
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    if (file.type === "application/pdf") {
      setPdfBlobUrl(URL.createObjectURL(file));
    }

    resetScan();
    setStatus("Scanning");
    setPhase("classify");
    setProgress(5);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("processorFamily", processorFamily);
    formData.append("gatewayLevel", level);

    uploadMutation.mutate(formData, {
      onSuccess: (data: any) => {
        const auditId = data.auditId ?? data.audit?.auditId;
        if (auditId) {
          setCurrentAuditId(auditId);
          setProgress(15);
          setPhase("extract");
          // Backend automatically scans on upload - no need to trigger again
        }
      },
      onError: (error: Error) => {
        setStatus("Idle");
        setPhase("idle");
        setProgress(0);
        toast({
          title: "Upload failed",
          description: error.message || "Something went wrong uploading the statement.",
          variant: "destructive",
        });
      },
    });

    // Reset file input so the same file can be re-selected
    e.target.value = "";
  }

  function startScan() {
    // Rescan requires an existing audit; upload a file first if none is loaded.
    if (!currentAuditId || isScanning) return;
    resetScan();
    setStatus("Scanning");
    setPhase("classify");
    setProgress(5);
    triggerScan.mutate(currentAuditId);
  }

  async function handleGatewayLevelChange(newLevel: "II" | "III") {
    // Always update local state (used for new uploads)
    setLevel(newLevel);

    // If there's an existing audit, also update it via API
    if (currentAuditId) {
      try {
        await fetch(`/api/audits/${currentAuditId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gatewayLevel: newLevel }),
        });

        // Invalidate audit query to refresh data
        await queryClient.invalidateQueries({ queryKey: ["/api/audits", currentAuditId] });

        // Show success toast
        toast({
          title: "Gateway Level Updated",
          description: `Changed to Level ${newLevel}. Consider re-scanning to update findings.`,
        });
      } catch (error) {
        console.error("Failed to update gateway level:", error);
        toast({
          title: "Update Failed",
          description: "Could not update gateway level. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      // No audit loaded yet - just update local state for next upload
      toast({
        title: "Gateway Level Set",
        description: `Level ${newLevel} will be used for the next upload.`,
      });
    }
  }

  // React to polling status changes from the API
  useEffect(() => {
    if (!auditStatusData || !currentAuditId) return;
    const apiStatus = auditStatusData.status;

    if (apiStatus === "scanning") {
      // Keep the scanning state with incremental progress
      setStatus("Scanning");
      setProgress((prev) => {
        const next = Math.min(prev + 5, 85);
        // Advance phases based on progress
        if (next >= 60) setPhase("downgrade");
        else if (next >= 40) setPhase("non_pci");
        else if (next >= 20) setPhase("extract");
        else setPhase("classify");
        return next;
      });
    } else if (apiStatus === "needs_review" || apiStatus === "complete") {
      setStatus(apiStatus === "complete" ? "Complete" : "Needs Review");
      setPhase("complete");
      setProgress(100);

      // Show celebration animation on completion (only once per audit)
      // TODO: Re-enable later - disabled for now per user request
      // if (celebratedAuditRef.current !== currentAuditId) {
      //   celebratedAuditRef.current = currentAuditId;
      //   setShowCelebration(true);
      // }

      // Refetch findings and audit data now that scan is done
      queryClient.invalidateQueries({ queryKey: ["/api/findings?auditId=" + currentAuditId] });
      queryClient.invalidateQueries({ queryKey: ["/api/audits", currentAuditId] });
    } else if (apiStatus === "failed") {
      setStatus("Idle");
      setPhase("idle");
      setProgress(0);
      toast({
        title: "Audit failed",
        description: auditStatusData.errorMessage || "The scan didn't complete. Check the server logs.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/audits", currentAuditId] });
    }
  }, [auditStatusData, currentAuditId, queryClient, toast]);

  // Populate real extracted data when the audit completes
  useEffect(() => {
    if (!auditData || !currentAuditId) return;

    const fmtMoney = (n?: number) =>
      typeof n === "number"
        ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : undefined;

    setFields((prev) => ({
      ...prev,
      company_dba: {
        ...prev.company_dba,
        value: auditData.dba ?? prev.company_dba.value,
        confidence: auditData.dba ? 0.9 : prev.company_dba.confidence,
      },
      mid: {
        ...prev.mid,
        value: auditData.mid ?? prev.mid.value,
        confidence: auditData.mid ? 0.95 : prev.mid.confidence,
      },
      statement_period: {
        ...prev.statement_period,
        value: auditData.statementPeriod ?? prev.statement_period.value,
        confidence: auditData.statementPeriod ? 0.94 : prev.statement_period.confidence,
      },
      total_submitted_volume: {
        ...prev.total_submitted_volume,
        value: fmtMoney(auditData.totalVolume) ?? prev.total_submitted_volume.value,
        confidence: auditData.totalVolume != null ? 0.92 : prev.total_submitted_volume.confidence,
      },
      amex_volume: {
        ...prev.amex_volume,
        value: fmtMoney(auditData.amexVolume) ?? prev.amex_volume.value,
        confidence: auditData.amexVolume != null ? 0.9 : prev.amex_volume.confidence,
      },
      total_fees: {
        ...prev.total_fees,
        value: fmtMoney(auditData.totalFees) ?? prev.total_fees.value,
        confidence: auditData.totalFees != null ? 0.9 : prev.total_fees.confidence,
      },
      amex_fees: {
        ...prev.amex_fees,
        value: fmtMoney(auditData.amexFees) ?? prev.amex_fees.value,
        confidence: auditData.amexFees != null ? 0.85 : prev.amex_fees.confidence,
      },
      effective_rate: {
        ...prev.effective_rate,
        value: auditData.effectiveRate != null ? `${(auditData.effectiveRate * 100).toFixed(2)}%` : prev.effective_rate.value,
        confidence: auditData.effectiveRate != null ? 0.88 : prev.effective_rate.confidence,
      },
      processor_detected: {
        ...prev.processor_detected,
        value: auditData.processorDetected ?? prev.processor_detected.value,
        confidence: auditData.processorDetected ? 0.9 : prev.processor_detected.confidence,
      },
    }));
  }, [auditData, currentAuditId]);

  // Level mismatch detection: once MID is detected, match against companies DB
  useEffect(() => {
    if (!auditData?.mid || !companiesData || !currentAuditId) return;
    // Only check once per audit
    if (levelMismatchCheckedRef.current === currentAuditId) return;
    levelMismatchCheckedRef.current = currentAuditId;

    const detectedMid = auditData.mid.replace(/\D/g, "");
    const currentLevel = auditData.gatewayLevel || level;

    // Find company whose MID matches
    const matchedCompany = companiesData.find((c) => {
      if (!c.mid) return false;
      const companyMid = c.mid.replace(/\D/g, "");
      return companyMid.length > 0 && (detectedMid === companyMid || detectedMid.endsWith(companyMid) || companyMid.endsWith(detectedMid));
    });

    if (!matchedCompany) return;

    // Company auditLevel is "Level II" or "Level III", convert to "II" or "III" for comparison
    const companyLevelShort = matchedCompany.auditLevel.replace(/^Level\s*/i, "");
    if (companyLevelShort !== currentLevel) {
      setLevelMismatch({
        companyName: matchedCompany.name,
        companyId: matchedCompany.companyId,
        companyLevel: companyLevelShort,
        auditLevel: currentLevel,
      });
    }
  }, [auditData, companiesData, currentAuditId, level]);

  // Populate real findings when they arrive from the API
  useEffect(() => {
    if (!findingsData || !currentAuditId) return;

    const nonPciFindings: NonPciRow[] = findingsData
      .filter((f) => f.type === "non_pci")
      .map((f) => ({
        id: f.findingId,
        raw: f.rawLine || f.title,
        amount: `$${f.amount.toFixed(2)}`,
        ref: {
          page: f.page,
          box: { x: 10, y: Math.max(5, (f.lineNum ?? 1) * 4), w: 54, h: 8 },
        },
        status: "Refund Candidate" as const,
      }));

    const mapDowngrade = (f: (typeof findingsData)[number]): DowngradeRow => ({
      id: f.findingId,
      ofTrans: "—",
      volume: `$${f.amount.toFixed(2)}`,
      raw: f.rawLine || f.title,
      downgradeRate: f.rate ? `${f.rate.toFixed(2)}%` : undefined,
      ifCorrected: f.targetRate ? `${f.targetRate.toFixed(2)}%` : undefined,
      revenueLost: f.spread != null ? `$${f.spread.toFixed(2)}` : "—",
      ref: {
        page: f.page,
        box: { x: 9, y: Math.max(5, (f.lineNum ?? 1) * 4), w: 78, h: 9 },
      },
      flagged: f.severity === "High",
      flagReason: f.reason || "",
      needsReview: !!f.needsReview,
      reviewReason: f.reason || "",
      page: f.page,
    });

    const downgradeFindings: DowngradeRow[] = findingsData
      .filter((f) => f.type === "downgrade" && f.status !== "false_positive" && !f.needsReview)
      .map(mapDowngrade);

    const reviewFindings: DowngradeRow[] = findingsData
      .filter((f) => f.type === "downgrade" && f.status !== "false_positive" && f.needsReview)
      .map(mapDowngrade);

    setNonPci(nonPciFindings);
    setDowngrades(downgradeFindings);
    setReviewDowngrades(reviewFindings);
  }, [findingsData, currentAuditId]);

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

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Gateway Level:</Label>
                  <Select
                    value={auditData?.gatewayLevel || level}
                    onValueChange={handleGatewayLevelChange}
                  >
                    <SelectTrigger data-testid="select-gateway-level" className="h-10 w-[140px]">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="II">Level II</SelectItem>
                      <SelectItem value="III">Level III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  data-testid="button-upload-pdf"
                  variant="outline"
                  className="h-10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4 mr-2" />
                  )}
                  <span className="hidden sm:inline">{uploadMutation.isPending ? "Uploading…" : "Upload PDF"}</span>
                </Button>

                <Button
                  data-testid="button-generate-report"
                  variant="outline"
                  className="h-10"
                  onClick={() => {
                    if (currentAuditId) {
                      window.location.href = `/report?auditId=${currentAuditId}`;
                    }
                  }}
                  disabled={!currentAuditId || (status !== "Complete" && status !== "Needs Review")}
                >
                  <FileText className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Generate Report</span>
                </Button>

                {currentAuditId && auditData?.processorDetected && (
                  <Badge
                    data-testid="badge-processor"
                    variant="outline"
                    className="h-10 px-3 bg-blue-500/10 text-blue-600 border-blue-500/20"
                  >
                    <Building2 className="w-3.5 h-3.5 mr-1.5" />
                    {auditData.processorDetected}
                  </Badge>
                )}

                <Button data-testid="button-reset-scan" variant="ghost" className="h-10" onClick={resetScan}>
                  Reset
                </Button>
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

              {(status === "Needs Review" || status === "Complete") && (nonPci.length > 0 || downgrades.length > 0 || (findingsData && findingsData.filter(f => f.type === "service_charge").length > 0)) && (
                <div className="flex items-center gap-3 text-xs">
                  {nonPci.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                      <span className="font-medium text-red-600">{nonPci.length} Non-PCI</span>
                      <span className="text-red-600/70 font-mono">${nonPciTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {downgrades.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-400/10 border border-yellow-500/20">
                      <span className="font-medium text-yellow-700">{downgrades.length} Downgrades</span>
                      {downgradeRollup.revenueLost > 0 && (
                        <span className="text-yellow-700/70 font-mono">${downgradeRollup.revenueLost.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                  {reviewDowngrades.length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <span className="font-medium text-amber-700">{reviewDowngrades.length} Needs Review</span>
                    </div>
                  )}
                  {findingsData && findingsData.filter(f => f.type === "service_charge" && f.spread != null && f.spread > 0).length > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/20">
                      <span className="font-medium text-violet-600">
                        {findingsData.filter(f => f.type === "service_charge" && f.spread != null && f.spread > 0).length} Overcharged
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 h-10">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Input
                    data-testid="input-statement-search"
                    className="h-9 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder="Search extracted fields & descriptors…"
                  />
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                </div>
                <div className="flex items-center gap-2">
                  <p data-testid="text-live-strip-downgrade-count" className="text-xs text-muted-foreground">
                    {downgrades.length} rows
                  </p>
                  {downgrades.length > 0 && (
                    <button
                      onClick={() => setDowngradesExpanded(!downgradesExpanded)}
                      className="p-0.5 rounded hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground"
                      title={downgradesExpanded ? "Collapse" : "Expand all"}
                    >
                      {downgradesExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className={`divide-y divide-border overflow-auto ${downgradesExpanded ? "max-h-[600px]" : "max-h-[150px]"}`}>
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
                      onClick={() => setSelectedDowngrade(r)}
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
                                className="text-[10px] bg-red-500/10 text-red-700 border-red-500/20"
                              >
                                High Priority
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

            {/* Needs Review Stream — ambiguous downgrade candidates awaiting Confirm/Dismiss */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between bg-secondary/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    data-testid="badge-live-strip-needs-review"
                    variant="outline"
                    className="text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                  >
                    Needs Review
                  </Badge>
                </div>
                <p data-testid="text-live-strip-needs-review-count" className="text-xs text-muted-foreground">
                  {reviewDowngrades.length} rows
                </p>
              </div>

              <div className="divide-y divide-border max-h-[220px] overflow-auto">
                {reviewDowngrades.length === 0 ? (
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground">
                      No ambiguous matches flagged.
                    </p>
                  </div>
                ) : (
                  reviewDowngrades.map((r) => (
                    <div
                      key={r.id}
                      data-testid={`strip-needs-review-${r.id}`}
                      className="px-3 py-2 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          className="min-w-0 text-left hover:bg-secondary/20 -mx-1 px-1 rounded"
                          onClick={() => setSelectedDowngrade(r)}
                        >
                          <p className="text-xs font-medium truncate">{r.raw}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            p.{r.page ?? r.ref.page} &middot; {r.downgradeRate ?? "—"} → {r.ifCorrected ?? "—"}
                          </p>
                          {r.reviewReason && (
                            <p className="text-[11px] text-amber-700/90 mt-0.5 line-clamp-2">
                              {r.reviewReason}
                            </p>
                          )}
                        </button>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs">{r.volume}</p>
                          <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                            {r.revenueLost ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          data-testid={`button-needs-review-confirm-${r.id}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs bg-amber-500/10 border-amber-500/30 text-amber-800 hover:bg-amber-500/20"
                          disabled={updateFindingMutation.isPending}
                          onClick={() =>
                            updateFindingMutation.mutate({
                              findingId: r.id,
                              needsReview: false,
                            })
                          }
                        >
                          Confirm
                        </Button>
                        <Button
                          data-testid={`button-needs-review-dismiss-${r.id}`}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={updateFindingMutation.isPending}
                          onClick={() =>
                            updateFindingMutation.mutate({
                              findingId: r.id,
                              status: "false_positive",
                            })
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Service Charges Stream */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between bg-secondary/20 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    data-testid="badge-live-strip-service-charge"
                    variant="outline"
                    className="text-[11px] bg-violet-500/10 text-violet-600 border-violet-500/20"
                  >
                    Service Charges
                  </Badge>
                </div>
                <p data-testid="text-live-strip-service-charge-count" className="text-xs text-muted-foreground">
                  {findingsData?.filter((f) => f.type === "service_charge").length ?? 0} rows
                </p>
              </div>

              <div className="divide-y divide-border max-h-[150px] overflow-auto">
                {(!findingsData || findingsData.filter((f) => f.type === "service_charge").length === 0) ? (
                  <div className="p-3">
                    <p data-testid="text-live-strip-service-charge-empty" className="text-xs text-muted-foreground">
                      {phase === "idle" ? "No rows yet." : "Streaming..."}
                    </p>
                  </div>
                ) : (
                  findingsData
                    .filter((f) => f.type === "service_charge")
                    .map((f) => {
                      const isOvercharged = f.spread != null && f.spread > 0;
                      // Discount rates are raw decimals (<0.1), transaction fees are dollar amounts
                      const isDiscountRate = /discount/i.test(f.title);
                      const fmtRate = isDiscountRate
                        ? `${(f.rate * 100).toFixed(4)}%`
                        : `$${f.rate.toFixed(4)}`;
                      const fmtTarget = f.targetRate != null
                        ? (isDiscountRate
                          ? `${((f.targetRate ?? 0) * 100).toFixed(4)}%`
                          : `$${(f.targetRate ?? 0).toFixed(4)}`)
                        : null;
                      return (
                        <button
                          key={f.findingId}
                          data-testid={`strip-service-charge-${f.findingId}`}
                          className="w-full text-left px-3 py-2 hover:bg-secondary/20 transition-colors"
                          onClick={() =>
                            jumpToEvidence(
                              { page: f.page, box: { x: 10, y: Math.max(5, (f.lineNum ?? 1) * 4), w: 54, h: 8 } },
                              f.findingId,
                            )
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{f.rawLine || f.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                p.{f.page} &middot; {f.title}
                              </p>
                            </div>
                            <div className="shrink-0 text-right flex items-center gap-2">
                              <div>
                                <p className="font-mono text-xs">{fmtRate}</p>
                                {fmtTarget && (
                                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                                    vs {fmtTarget}
                                  </p>
                                )}
                              </div>
                              {isOvercharged ? (
                                <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                                  <AlertTriangle className="w-3 h-3 mr-0.5" />
                                  OVER
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                  OK
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* PDF Viewer */}
        <Card className="overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-border bg-secondary/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
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
                  Page {selectedPage} / {numPages}
                </Badge>
                <Button data-testid="button-prev-page" size="sm" variant="outline" onClick={() => setSelectedPage((p) => Math.max(1, p - 1))} disabled={selectedPage <= 1}>
                  Prev
                </Button>
                <Button data-testid="button-next-page" size="sm" variant="outline" onClick={() => setSelectedPage((p) => Math.min(numPages, p + 1))} disabled={selectedPage >= numPages}>
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div className="relative aspect-[3/4] bg-gradient-to-b from-background to-secondary/20">
            <div className="absolute inset-0 p-2 sm:p-6">
              <div className="h-full rounded-xl border border-border bg-card shadow-sm overflow-hidden relative">
                <div className="absolute inset-x-0 top-0 h-10 border-b border-border bg-secondary/20 flex items-center justify-between px-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span data-testid="text-pdf-filename">Statement_2024-01.pdf</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Badge
                      data-testid="badge-outline-red"
                      variant="outline"
                      className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20"
                    >
                      <span className="hidden sm:inline">RED • </span>Non-PCI
                    </Badge>
                    <Badge
                      data-testid="badge-outline-yellow"
                      variant="outline"
                      className="text-[10px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                    >
                      <span className="hidden sm:inline">YELLOW • </span>Downgrade
                    </Badge>
                  </div>
                </div>

                <div className="absolute inset-0 pt-10 overflow-auto" ref={pdfContainerRef}>
                  {pdfBlobUrl ? (
                    <Document
                      file={pdfBlobUrl}
                      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                      loading={
                        <div className="h-full flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      }
                      className="flex justify-center py-4"
                    >
                      <Page
                        pageNumber={selectedPage}
                        width={pdfContainerRef.current?.clientWidth ? pdfContainerRef.current.clientWidth - 48 : 600}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                    </Document>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-background/70">
                      {status === "Idle" ? (
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
                                Upload a PDF statement to view it here and start scanning.
                              </p>
                              <div className="mt-4 flex items-center gap-2">
                                <Button data-testid="button-primary-upload" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                  <UploadCloud className="w-4 h-4 mr-2" /> Upload PDF
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <p className="text-sm">Scanning…</p>
                        </div>
                      )}
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

        {/* Live Extracted Data — below the PDF viewer */}
        <Card className="overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5">
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
                              {k === "processor_detected" && f.value && (
                                <p data-testid="text-parser-type" className="text-[10px] text-muted-foreground mt-1">
                                  Parser: {getParserType(f.value)}
                                </p>
                              )}
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
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Totals & rollups</p>
                    <Badge data-testid="badge-rollups" variant="outline" className="text-[11px] text-muted-foreground">
                      Phase E
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <div className="space-y-3">
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0">
                                <p data-testid="text-review-before-saving-title" className="text-xs font-semibold text-amber-800">
                                  High Priority Findings
                                </p>
                                <p data-testid="text-review-before-saving-body" className="text-[11px] text-amber-800/80 mt-1">
                                  {downgrades.filter((d) => d.flagged).length} high priority downgrade(s) detected. Review below before finalizing.
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  data-testid="button-open-review"
                                  size="sm"
                                  className="h-8 bg-amber-700 hover:bg-amber-800 text-white"
                                  onClick={() => setReviewOpen((v) => !v)}
                                >
                                  {reviewOpen ? "Hide review" : "Open review"}
                                </Button>
                                <Button
                                  data-testid="button-mark-reviewed-later"
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => {
                                    setReviewOpen(false);
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

                      {reviewOpen && findingsData && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-2">
                          <p className="text-xs font-semibold text-amber-800 mb-3">High Priority Findings</p>
                          {findingsData
                            .filter((f) => f.type === "downgrade" && f.severity === "High" && f.status === "open")
                            .map((f) => (
                              <div
                                key={f.findingId}
                                className="rounded-lg border border-border bg-white dark:bg-background p-3 flex flex-col sm:flex-row sm:items-center gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-mono truncate">{f.rawLine || f.title}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    p.{f.page} &middot; {f.reason}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      const match = downgrades.find((d) => d.id === f.findingId);
                                      if (match) setSelectedDowngrade(match);
                                    }}
                                  >
                                    Detail
                                  </Button>
                                </div>
                              </div>
                            ))}
                          {findingsData.filter((f) => f.type === "downgrade" && f.severity === "High" && f.status === "open").length === 0 && (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                              <p className="text-xs text-emerald-800 font-medium">All high priority findings have been reviewed.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
          </div>
        </Card>


        {/* All Processing Line Items */}
        {findingsData && findingsData.length > 0 && (
          <Card className="overflow-hidden shadow-sm">
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">All Processing Line Items</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Every extracted line item from the statement. High priority findings are highlighted.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {findingsData.length} items
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-4 px-3 py-2 bg-secondary/20 text-[11px] font-medium text-muted-foreground border-b border-border">
                  <span>Description</span>
                  <span className="text-right">Amount</span>
                  <span className="hidden sm:block text-right">Rate</span>
                  <span className="text-center">Type</span>
                </div>
                <div className="divide-y divide-border max-h-[400px] overflow-auto">
                  {findingsData
                    .slice()
                    .sort((a, b) => (a.page !== b.page ? a.page - b.page : a.lineNum - b.lineNum))
                    .map((f) => {
                      const isFlagged = f.type === "non_pci" || f.type === "downgrade" || (f.type === "service_charge" && f.spread != null && f.spread > 0);
                      const bgClass = f.type === "non_pci"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : f.type === "downgrade"
                          ? "bg-yellow-400/5 hover:bg-yellow-400/10"
                          : f.type === "service_charge"
                            ? (f.spread && f.spread > 0 ? "bg-violet-500/5 hover:bg-violet-500/10" : "hover:bg-secondary/20")
                            : "hover:bg-secondary/20";
                      const borderClass = f.type === "non_pci"
                        ? "border-l-2 border-l-red-500"
                        : f.type === "downgrade"
                          ? "border-l-2 border-l-yellow-500"
                          : f.type === "service_charge"
                            ? "border-l-2 border-l-violet-500"
                            : "border-l-2 border-l-transparent";

                      return (
                        <button
                          key={f.findingId}
                          className={`w-full text-left grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-3 sm:gap-x-4 px-3 py-2.5 transition-colors ${bgClass} ${borderClass}`}
                          onClick={() => {
                            if (f.type === "downgrade") {
                              const match = downgrades.find((d) => d.id === f.findingId);
                              if (match) setSelectedDowngrade(match);
                            } else {
                              jumpToEvidence(
                                { page: f.page, box: { x: 10, y: Math.max(5, (f.lineNum ?? 1) * 4), w: 54, h: 8 } },
                                f.findingId,
                              );
                            }
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{f.rawLine || f.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              p.{f.page} &middot; line {f.lineNum}
                              {f.severity === "High" && (
                                <span className="ml-2 text-red-600 font-medium">High severity</span>
                              )}
                            </p>
                          </div>
                          <p className="font-mono text-xs text-right self-center whitespace-nowrap">
                            ${f.amount.toFixed(2)}
                          </p>
                          <p className="hidden sm:block font-mono text-xs text-right self-center whitespace-nowrap text-muted-foreground">
                            {f.rate > 0 ? `${f.rate.toFixed(2)}%` : "—"}
                          </p>
                          <div className="self-center text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                f.type === "non_pci"
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : f.type === "downgrade"
                                    ? "bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                                    : f.type === "service_charge"
                                      ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                                      : "text-muted-foreground"
                              }`}
                            >
                              {f.type === "non_pci" ? "Non-PCI" : f.type === "downgrade" ? "Downgrade" : f.type === "service_charge" ? "Svc Charge" : "Unknown"}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </Card>
        )}

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

            <div className="flex flex-wrap items-center gap-2">
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
                data-testid="button-generate-report"
                className="bg-foreground text-background hover:bg-foreground/90"
                onClick={() => {
                  window.location.href = "/report";
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Generate report
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

      {/* Downgrade Detail Modal */}
      <Dialog open={!!selectedDowngrade} onOpenChange={(open) => !open && setSelectedDowngrade(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 text-yellow-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">Downgrade Detail</DialogTitle>
                <DialogDescription className="text-xs">
                  Page {selectedDowngrade?.ref.page}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedDowngrade && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/10 p-3">
                <p className="text-[11px] text-muted-foreground font-medium">Raw line</p>
                <p className="text-sm font-mono mt-1 break-words">{selectedDowngrade.raw}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-secondary/10 p-3">
                  <p className="text-[11px] text-muted-foreground">Volume</p>
                  <p className="font-mono text-sm mt-1">{selectedDowngrade.volume}</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/10 p-3">
                  <p className="text-[11px] text-muted-foreground">Revenue lost (est.)</p>
                  <p className="font-mono text-sm mt-1 text-red-600">{selectedDowngrade.revenueLost ?? "—"}</p>
                </div>
                {selectedDowngrade.downgradeRate && (
                  <div className="rounded-lg border border-border bg-secondary/10 p-3">
                    <p className="text-[11px] text-muted-foreground">Downgrade rate</p>
                    <p className="font-mono text-sm mt-1">{selectedDowngrade.downgradeRate}</p>
                  </div>
                )}
                {selectedDowngrade.ifCorrected && (
                  <div className="rounded-lg border border-border bg-secondary/10 p-3">
                    <p className="text-[11px] text-muted-foreground">If corrected</p>
                    <p className="font-mono text-sm mt-1 text-emerald-600">{selectedDowngrade.ifCorrected}</p>
                  </div>
                )}
                <div className="rounded-lg border border-border bg-secondary/10 p-3">
                  <p className="text-[11px] text-muted-foreground"># Transactions</p>
                  <p className="font-mono text-sm mt-1">{selectedDowngrade.ofTrans}</p>
                </div>
              </div>

              {selectedDowngrade.flagged && selectedDowngrade.flagReason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-800">High Priority</p>
                      <p className="text-xs text-red-800/80 mt-0.5">{selectedDowngrade.flagReason}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    jumpToEvidence(selectedDowngrade.ref, selectedDowngrade.id);
                    setSelectedDowngrade(null);
                  }}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Jump to evidence
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedDowngrade(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Level Mismatch Dialog */}
      <Dialog open={!!levelMismatch} onOpenChange={(open) => !open && setLevelMismatch(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base">Level Mismatch Detected</DialogTitle>
                <DialogDescription className="text-xs">
                  The audit level doesn't match the company database.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {levelMismatch && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10 p-3">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">{levelMismatch.companyName}</span> is set to{" "}
                  <span className="font-mono font-semibold">Level {levelMismatch.companyLevel}</span> in the company database,
                  but this audit is set to{" "}
                  <span className="font-mono font-semibold">Level {levelMismatch.auditLevel}</span>.
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  className="w-full justify-start h-10"
                  variant="outline"
                  onClick={async () => {
                    await handleGatewayLevelChange(levelMismatch.companyLevel as "II" | "III");
                    setLevelMismatch(null);
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" />
                  Change audit to Level {levelMismatch.companyLevel}
                </Button>
                <Button
                  className="w-full justify-start h-10"
                  variant="outline"
                  onClick={async () => {
                    const newLevel = `Level ${levelMismatch.auditLevel}`;
                    updateCompanyMutation.mutate(
                      { companyId: levelMismatch.companyId, auditLevel: newLevel },
                      {
                        onSuccess: () => {
                          toast({
                            title: "Company Updated",
                            description: `${levelMismatch.companyName} changed to ${newLevel}.`,
                          });
                        },
                      },
                    );
                    setLevelMismatch(null);
                  }}
                >
                  <Building2 className="w-4 h-4 mr-2 text-blue-600" />
                  Update company to Level {levelMismatch.auditLevel}
                </Button>
                <Button
                  className="w-full justify-start h-10"
                  variant="ghost"
                  onClick={() => setLevelMismatch(null)}
                >
                  Ignore for now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Celebration animation on audit completion */}
      <AuditCelebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
        findingsCount={downgrades.length + nonPci.length}
        savingsAmount={
          downgrades.reduce((sum, d) => {
            const lost = d.revenueLost ? parseFloat(d.revenueLost.replace(/[$,]/g, "")) : 0;
            return sum + (isNaN(lost) ? 0 : lost);
          }, 0)
        }
      />
    </DashboardLayout>
  );
}
