import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  X,
  Sparkles,
  Files,
  Building2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { AuditStatus } from "@/lib/api";
import AddCompanyDialog from "@/components/AddCompanyDialog";

type GatewayLevel = "II" | "III";

type BulkFileStatus = "queued" | "uploading" | "scanning" | "complete" | "needs_review" | "error";

type BulkFileEntry = {
  id: string;
  // Optional: only present for files added during this session. When
  // we hydrate the queue from localStorage after the auditor reviews
  // an audit and comes back, we lose the underlying File but keep its
  // metadata so the row still renders correctly.
  file?: File;
  fileName: string;
  fileSize: number;
  status: BulkFileStatus;
  progress: number;
  auditId?: string;
  merchant?: string;
  processorDetected?: string;
  findings?: { nonPci: number; downgrades: number; revenueLost: number };
  // Whether this audit's merchant already exists in the Companies table.
  // Populated alongside `findings` when the post-scan summary is fetched.
  // `undefined` = not checked yet; `false` = no match → show "Add" button.
  companyMatched?: boolean;
  error?: string;
};

// localStorage keys — the bulk queue persists across navigation so
// users can dive into a single-audit review and come back without
// losing their place. `reviewed-audits` is a Set of auditIds the
// user has hit "Mark reviewed" on inside the workspace.
const BULK_STATE_KEY = "weaudit:bulk-state";
const REVIEWED_AUDITS_KEY = "weaudit:reviewed-audits";

function uid() {
  return Math.random().toString(16).slice(2);
}

function statusLabel(s: BulkFileStatus) {
  switch (s) {
    case "queued": return "Queued";
    case "uploading": return "Uploading";
    case "scanning": return "Scanning";
    case "complete": return "Complete";
    case "needs_review": return "Needs Review";
    case "error": return "Error";
  }
}

function statusColor(s: BulkFileStatus) {
  switch (s) {
    case "queued": return "text-muted-foreground";
    case "uploading": return "text-blue-600 bg-blue-500/10 border-blue-500/20";
    case "scanning": return "text-amber-600 bg-amber-500/10 border-amber-500/20";
    case "complete": return "text-green-600 bg-green-500/10 border-green-500/20";
    case "needs_review": return "text-orange-600 bg-orange-500/10 border-orange-500/20";
    case "error": return "text-red-600 bg-red-500/10 border-red-500/20";
  }
}

function StatusIcon({ status }: { status: BulkFileStatus }) {
  switch (status) {
    case "queued": return <Clock className="w-4 h-4 text-muted-foreground" />;
    case "uploading": return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case "scanning": return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
    case "complete": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "needs_review": return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case "error": return <AlertCircle className="w-4 h-4 text-red-500" />;
  }
}

export default function BulkAudit() {
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<BulkFileEntry[]>(() => {
    // Hydrate from the previous session if the auditor came back from
    // a workspace review. We strip the underlying File on serialize
    // (Files don't survive JSON), so re-runs of in-flight items would
    // need re-uploading; everything past "scanning" status carries on
    // fine without it.
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(BULK_STATE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Array<Omit<BulkFileEntry, "file">>;
      return parsed.map((e) => ({ ...e }));
    } catch {
      return [];
    }
  });
  const [reviewedAudits, setReviewedAudits] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(REVIEWED_AUDITS_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set<string>();
    }
  });

  // Persist queue + reviewed set whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // File objects are not JSON-serializable; strip them before saving.
    const serializable = entries.map(({ file: _file, ...rest }) => rest);
    window.localStorage.setItem(BULK_STATE_KEY, JSON.stringify(serializable));
  }, [entries]);

  // Re-read reviewed set whenever the tab regains focus — covers the
  // case where the workspace marks an audit reviewed and then sends
  // the user back here.
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = window.localStorage.getItem(REVIEWED_AUDITS_KEY);
        setReviewedAudits(new Set<string>(raw ? (JSON.parse(raw) as string[]) : []));
      } catch {
        // ignore
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isRunning, setIsRunning] = useState(false);
  // Gateway Level applies to every file in the batch. Without it the runner
  // skips its rule filter and matches both L2 and L3 rules on every line,
  // which doubles findings and corrupts target rates. Default to L2 to mirror
  // the single-upload page.
  const [gatewayLevel, setGatewayLevel] = useState<GatewayLevel>("II");
  // "Add company" prompt state — shared across all rows. Stores the entry
  // we're prompting for so the dialog can prefill its fields and the
  // success handler knows which row to mark matched.
  const [addCompanyForEntry, setAddCompanyForEntry] = useState<BulkFileEntry | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter((f) => {
        const ext = f.name.toLowerCase();
        return ext.endsWith(".pdf") || ext.endsWith(".csv");
      });
      if (valid.length < files.length) {
        toast({
          title: "Some files skipped",
          description: "Only PDF and CSV files are accepted.",
          variant: "destructive",
        });
      }
      const newEntries: BulkFileEntry[] = valid.map((f) => ({
        id: uid(),
        file: f,
        fileName: f.name,
        fileSize: f.size,
        status: "queued" as BulkFileStatus,
        progress: 0,
      }));
      setEntries((prev) => [...prev, ...newEntries]);
    },
    [toast],
  );

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const clearCompleted = () => {
    setEntries((prev) => prev.filter((e) => e.status !== "complete" && e.status !== "error"));
  };

  // Poll audit status until it finishes. Throws on "failed" so the caller's
  // catch can surface the error; swallows transient fetch errors and retries.
  const waitForAudit = useCallback(async (auditId: string): Promise<AuditStatus> => {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      let data: { status: AuditStatus; errorMessage?: string } | undefined;
      try {
        const res = await fetch(`/api/audits/${auditId}/status`, { credentials: "include" });
        if (!res.ok) continue;
        data = await res.json();
      } catch {
        continue;
      }
      if (!data) continue;
      if (data.status === "complete" || data.status === "needs_review") return data.status;
      if (data.status === "failed") {
        throw new Error(data.errorMessage || "Scan failed without a reported reason.");
      }
    }
    return "needs_review"; // timeout fallback
  }, []);

  const startBulkUpload = useCallback(async () => {
    const queued = entries.filter((e) => e.status === "queued");
    if (queued.length === 0 || isRunning) return;

    setIsRunning(true);
    // Note: no explicit user click — addFiles auto-fires this. The
    // setIsRunning above gates re-entry from the auto-start effect.

    for (const entry of queued) {
      // Mark as uploading
      setEntries((prev) =>
        prev.map((e) => e.id === entry.id ? { ...e, status: "uploading" as BulkFileStatus, progress: 15 } : e),
      );

      try {
        if (!entry.file) {
          // Hydrated from a previous session — File blob is gone.
          // Skip rather than fail, leaving the row in its persisted
          // state.
          continue;
        }
        // Upload via single-file endpoint
        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("gatewayLevel", gatewayLevel);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const auditId = data.auditId ?? data.audit?.auditId;

        // Mark as scanning
        setEntries((prev) =>
          prev.map((e) => e.id === entry.id ? { ...e, auditId, status: "scanning" as BulkFileStatus, progress: 40 } : e),
        );

        // Wait for scan to finish
        const finalStatus = await waitForAudit(auditId);

        // Pull the audit + findings so we can show a one-line summary
        // inline (matches what /api/reports/:auditId computes for the
        // detail page: non-PCI count + downgrade count + revenue lost $).
        let summary: BulkFileEntry["findings"];
        let merchant: string | undefined;
        let processorDetected: string | undefined;
        let companyMatched: boolean | undefined;
        try {
          const detailRes = await fetch(`/api/audits/${auditId}`, { credentials: "include" });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const findings: Array<{ type: string; status: string; needsReview?: boolean; amount: number; spread?: number; rate: number }> =
              detail.findings || [];
            const nonPci = findings.filter((f) => f.type === "non_pci" && f.status !== "false_positive");
            const downgrades = findings.filter(
              (f) => f.type === "downgrade" && f.status !== "false_positive" && !f.needsReview,
            );
            const serviceCharges = findings.filter((f) => f.type === "service_charge" && f.status !== "false_positive");
            const totalNonPci = nonPci.reduce((s, f) => s + (f.amount || 0), 0);
            const totalDowngrade = downgrades.reduce((s, f) => s + (f.spread || 0), 0);
            const totalServiceCharge = serviceCharges
              .filter((f) => f.spread != null && f.spread > 0)
              .reduce((s, f) => s + (f.rate > 0 ? f.amount * (f.spread || 0) / f.rate : 0), 0);
            summary = {
              nonPci: nonPci.length,
              downgrades: downgrades.length,
              revenueLost: totalNonPci + totalDowngrade + totalServiceCharge,
            };
            merchant = detail.dba || detail.clientName;
            processorDetected = detail.processorDetected;
            companyMatched = detail.companyMatch?.matched === true;
          }
        } catch {
          // Summary is best-effort — don't fail the whole entry if it can't load.
        }

        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? {
                  ...e,
                  status: finalStatus === "complete" ? "complete" as BulkFileStatus : "needs_review" as BulkFileStatus,
                  progress: 100,
                  findings: summary,
                  merchant: merchant || e.merchant,
                  processorDetected: processorDetected || e.processorDetected,
                  companyMatched,
                }
              : e,
          ),
        );
      } catch (err) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, status: "error" as BulkFileStatus, error: (err as Error).message }
              : e,
          ),
        );
      }
    }

    setIsRunning(false);
    toast({
      title: "Bulk audit complete",
      description: `Processed ${queued.length} file${queued.length !== 1 ? "s" : ""}.`,
    });
  }, [entries, isRunning, toast, waitForAudit, gatewayLevel]);

  // Auto-start the run as soon as files land in the queue. Re-entry
  // is gated by isRunning (set inside startBulkUpload), so additional
  // files added while a run is in flight join the same loop instead of
  // spawning a parallel one.
  useEffect(() => {
    if (isRunning) return;
    if (entries.some((e) => e.status === "queued")) {
      void startBulkUpload();
    }
  }, [entries, isRunning, startBulkUpload]);

  const totalFiles = entries.length;
  const completedFiles = entries.filter((e) => e.status === "complete" || e.status === "needs_review").length;
  const queuedFiles = entries.filter((e) => e.status === "queued").length;
  const activeFiles = entries.filter((e) => e.status === "uploading" || e.status === "scanning").length;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-heading tracking-tight">Bulk Audit</h1>
            <p className="text-muted-foreground">
              Drop multiple statements at once. Processor and company details are auto-detected.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="bulk-gateway-level" className="text-sm whitespace-nowrap">
                Gateway Level
              </Label>
              <Select
                value={gatewayLevel}
                onValueChange={(v) => setGatewayLevel(v as GatewayLevel)}
                disabled={isRunning}
              >
                <SelectTrigger id="bulk-gateway-level" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="II">Level II</SelectItem>
                  <SelectItem value="III">Level III</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalFiles > 0 && (
              <div className="text-right text-sm text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{completedFiles}</span> / {totalFiles} complete
              </div>
            )}
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out cursor-pointer group ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.005]"
              : "border-border bg-card hover:bg-secondary/30 hover:border-primary/40"
          } ${totalFiles === 0 ? "py-24 px-10" : "py-12 px-10"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept=".pdf,.csv"
            onChange={handleFileSelect}
          />

          <div className="flex flex-col items-center text-center">
            <div
              className={`rounded-full flex items-center justify-center mb-5 transition-all ${
                isDragging
                  ? "w-20 h-20 bg-primary/20"
                  : "w-16 h-16 bg-primary/10 group-hover:bg-primary/15"
              }`}
            >
              <UploadCloud className={`text-primary transition-all ${isDragging ? "w-10 h-10" : "w-8 h-8"}`} />
            </div>

            <h3 className="text-xl font-semibold mb-2">
              {totalFiles === 0
                ? "Drop statement files here"
                : "Drop more files to add to the queue"}
            </h3>
            <p className="text-muted-foreground max-w-lg mb-6">
              {totalFiles === 0
                ? "Drag & drop as many PDF or CSV statements as you need. Each file becomes its own audit with auto-detected merchant, processor, and findings."
                : `${queuedFiles} queued, ${activeFiles} processing, ${completedFiles} done`}
            </p>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="lg" className="min-w-[160px]">
                <Files className="w-4 h-4 mr-2" />
                Browse Files
              </Button>
            </div>
          </div>
        </div>

        {/* Queue / progress */}
        {entries.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold">Audit Queue</h2>
                <Badge variant="outline">{entries.length} file{entries.length !== 1 ? "s" : ""}</Badge>
                {(() => {
                  const reviewedCount = entries.filter(
                    (e) => e.auditId && reviewedAudits.has(e.auditId),
                  ).length;
                  return reviewedCount > 0 ? (
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-500/10 border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      {reviewedCount} reviewed
                    </Badge>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-2">
                {completedFiles > 0 && !isRunning && (
                  <Button variant="ghost" size="sm" onClick={clearCompleted}>
                    Clear completed
                  </Button>
                )}
                {isRunning && (
                  <Badge variant="outline" className="text-amber-700 bg-amber-500/10 border-amber-500/20">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Processing {activeFiles + queuedFiles} file{activeFiles + queuedFiles !== 1 ? "s" : ""}…
                  </Badge>
                )}
              </div>
            </div>

            {/* Overall progress */}
            {totalFiles > 0 && activeFiles + completedFiles > 0 && (
              <div className="px-4 py-3 bg-secondary/20 border-b border-border">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Overall progress</span>
                  <span className="font-mono font-semibold">
                    {Math.round((completedFiles / totalFiles) * 100)}%
                  </span>
                </div>
                <Progress value={(completedFiles / totalFiles) * 100} className="h-2" />
              </div>
            )}

            {/* File list */}
            <div className="divide-y divide-border">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`px-4 py-3 flex items-center gap-4 transition-colors ${
                    entry.status === "complete" ? "bg-green-500/[0.03]" : ""
                  }`}
                >
                  <StatusIcon status={entry.status} />

                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{entry.fileName}</p>
                      {(() => {
                        const isReviewed = entry.auditId && reviewedAudits.has(entry.auditId);
                        // Once an audit is reviewed, "Needs Review" is
                        // moot — the auditor has already taken a look.
                        // Hide the status badge in that case so the
                        // green Reviewed pill stands alone.
                        if (isReviewed && entry.status === "needs_review") {
                          return (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 bg-emerald-500/10 border-emerald-500/20"
                              title="You've reviewed this audit in the workspace"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Reviewed
                            </Badge>
                          );
                        }
                        return (
                          <>
                            <Badge variant="outline" className={statusColor(entry.status)}>
                              {statusLabel(entry.status)}
                            </Badge>
                            {isReviewed && (
                              <Badge
                                variant="outline"
                                className="text-emerald-700 bg-emerald-500/10 border-emerald-500/20"
                                title="You've reviewed this audit in the workspace"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Reviewed
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{(entry.fileSize / 1024).toFixed(0)} KB</span>
                      {entry.merchant && (
                        <>
                          <span className="text-border">|</span>
                          <span>{entry.merchant}</span>
                        </>
                      )}
                      {entry.processorDetected && (
                        <>
                          <span className="text-border">|</span>
                          <span>{entry.processorDetected}</span>
                        </>
                      )}
                    </div>

                    {(entry.status === "uploading" || entry.status === "scanning") && (
                      <Progress value={entry.progress} className="h-1 mt-2" />
                    )}

                    {entry.error && (
                      <p className="text-xs text-red-500 mt-1">{entry.error}</p>
                    )}

                    {(entry.status === "complete" || entry.status === "needs_review") && entry.findings && (
                      <div className="flex items-center gap-4 text-xs mt-1.5">
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">Non-PCI:</span>
                          <span className={`font-mono font-semibold ${entry.findings.nonPci > 0 ? "text-orange-600" : "text-foreground"}`}>
                            {entry.findings.nonPci}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">Downgrades:</span>
                          <span className={`font-mono font-semibold ${entry.findings.downgrades > 0 ? "text-amber-600" : "text-foreground"}`}>
                            {entry.findings.downgrades}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-muted-foreground">Revenue Lost:</span>
                          <span className={`font-mono font-semibold ${entry.findings.revenueLost > 0 ? "text-green-600" : "text-foreground"}`}>
                            {entry.findings.revenueLost.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(entry.status === "complete" || entry.status === "needs_review") && entry.companyMatched === false && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddCompanyForEntry(entry);
                        }}
                      >
                        <Building2 className="w-3.5 h-3.5 mr-1.5" />
                        Add company
                      </Button>
                    )}
                    {(entry.status === "complete" || entry.status === "needs_review") && entry.auditId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open the same workspace-with-sidebar the
                          // single-audit dashboard uses, in full-screen
                          // mode, bound to this audit. `from=bulk`
                          // tells the workspace to render a "Mark
                          // reviewed & back" button instead of just an
                          // exit-fullscreen toggle.
                          setLocation(`/dashboard?auditId=${entry.auditId}&fullscreen=1&from=bulk`);
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        {entry.status === "needs_review" ? "Review" : "Findings"}
                      </Button>
                    )}
                    {entry.status === "queued" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEntry(entry.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <AddCompanyDialog
        open={!!addCompanyForEntry}
        onOpenChange={(o) => { if (!o) setAddCompanyForEntry(null); }}
        defaultName={addCompanyForEntry?.merchant || addCompanyForEntry?.fileName.replace(/\.[^.]+$/, "") || ""}
        defaultProcessor={addCompanyForEntry?.processorDetected}
        fromAuditId={addCompanyForEntry?.auditId}
        onCreated={() => {
          // Mark the row as matched so the button hides without a refetch
          if (addCompanyForEntry) {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === addCompanyForEntry.id
                  ? { ...e, companyMatched: true }
                  : e,
              ),
            );
          }
        }}
      />
    </DashboardLayout>
  );
}
