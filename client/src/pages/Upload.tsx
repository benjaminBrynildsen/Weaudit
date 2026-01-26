import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  X,
  Sparkles,
  Wand2,
  Users,
  Building2,
  CreditCard,
  DollarSign,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

type UploadStatus = "idle" | "uploading" | "processing" | "review" | "done";

type Processor = "CardConnect" | "Fiserv" | "VersaPay" | "Stripe" | "Square" | "Chase" | "Other";

type UploadedStatement = {
  id: string;
  fileName: string;
  processor: Processor;
  month: string;
  businessName: string;
  mid?: string;
  estimatedVolume?: string;
  status: UploadStatus;
  progress: number;
  findingsPreview?: {
    potentialSavingsMonthly: number;
    confidence: "High" | "Medium" | "Low";
    unknownFees: number;
  };
  notices?: Array<{ type: "annual_fee"; amount: number; message: string }>;
};

function uid() {
  return Math.random().toString(16).slice(2);
}

const sampleQuestions = [
  {
    id: "q-processing-model",
    label: "How are you processing today?",
    hint: "Helps AutoAudit route to the right benchmark & rule pack.",
  },
  {
    id: "q-card-present",
    label: "Card-present or card-not-present?",
    hint: "Affects expected interchange bands.",
  },
  {
    id: "q-has-amex",
    label: "Do you process American Express on the same statement?",
    hint: "We can exclude AmEx from effective rate calculations.",
  },
];

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [processor, setProcessor] = useState<Processor>("CardConnect");
  const [month, setMonth] = useState("2024-01");
  const [businessName, setBusinessName] = useState("Acme Coffee Roasters");
  const [mid, setMid] = useState("MID-0042187");
  const [estimatedVolume, setEstimatedVolume] = useState("$85,000");

  const [autoAuditEligible, setAutoAuditEligible] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({
    [sampleQuestions[0].id]: "Interchange-plus",
    [sampleQuestions[1].id]: "Mostly card-present",
    [sampleQuestions[2].id]: "Yes, but exclude from OER",
  });

  const [unknownFeeApprovalEnabled, setUnknownFeeApprovalEnabled] = useState(true);
  const [unknownFeeThreshold, setUnknownFeeThreshold] = useState("$1.00");

  const [statements, setStatements] = useState<UploadedStatement[]>([
    {
      id: "st-" + uid(),
      fileName: "CardConnect_Statement_Jan_2024.pdf",
      processor: "CardConnect",
      month: "2024-01",
      businessName: "Acme Coffee Roasters",
      mid: "MID-0042187",
      estimatedVolume: "$85,000",
      status: "done",
      progress: 100,
      findingsPreview: { potentialSavingsMonthly: 612.4, confidence: "High", unknownFees: 3 },
      notices: [
        {
          type: "annual_fee",
          amount: 499,
          message:
            "We found an annual fee was charged to this account in the amount of $499 and have requested a refund on your behalf.",
        },
      ],
    },
  ]);

  const eligibleReason = useMemo(() => {
    if (!autoAuditEligible) {
      return "Auto audit disabled — this statement will route to Human Review.";
    }
    return "Eligible for automatic audit based on your answers.";
  }, [autoAuditEligible]);

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
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const simulatePipeline = (statementId: string) => {
    setStatements((prev) =>
      prev.map((s) =>
        s.id === statementId
          ? {
              ...s,
              status: "uploading",
              progress: 10,
            }
          : s,
      ),
    );

    const steps: Array<{ status: UploadStatus; inc: number; label: string }> = [
      { status: "uploading", inc: 25, label: "Uploading" },
      { status: "processing", inc: 35, label: "Parsing & normalizing" },
      { status: autoAuditEligible ? "done" : "review", inc: 40, label: autoAuditEligible ? "Generating findings" : "Routing to Human Review" },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      setStatements((prev) => {
        const next = prev.map((s) => {
          if (s.id !== statementId) return s;
          const step = steps[Math.min(stepIndex, steps.length - 1)];
          const nextProgress = Math.min(100, s.progress + step.inc);
          const nextStatus = step.status;
          return {
            ...s,
            status: nextStatus,
            progress: nextProgress,
            findingsPreview:
              nextProgress >= 100
                ? {
                    potentialSavingsMonthly: processor === "CardConnect" ? 612.4 : 421.9,
                    confidence: autoAuditEligible ? ("High" as const) : ("Medium" as const),
                    unknownFees: unknownFeeApprovalEnabled ? 3 : 7,
                  }
                : s.findingsPreview,
          };
        });
        return next;
      });

      stepIndex += 1;
      if (stepIndex >= steps.length) {
        clearInterval(interval);
        toast({
          title: autoAuditEligible ? "Audit complete" : "Human review queued",
          description: autoAuditEligible
            ? "Your statement was audited automatically and findings are ready."
            : "This statement needs a quick human review before reporting.",
        });
      }
    }, 450);
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);

    const statement: UploadedStatement = {
      id: "st-" + uid(),
      fileName: newFiles[0]?.name ?? "statement.pdf",
      processor,
      month,
      businessName,
      mid,
      estimatedVolume,
      status: "idle",
      progress: 0,
      notices: [],
    };

    setStatements((prev) => [statement, ...prev]);
    simulatePipeline(statement.id);
  };

  const removeLocalFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const addAnnualFeeNotice = (statementId: string) => {
    const message =
      "We found an annual fee was charged to this account in the amount of $499 and have requested a refund on your behalf.";

    setStatements((prev) =>
      prev.map((s) =>
        s.id === statementId
          ? {
              ...s,
              notices: [
                ...(s.notices ?? []),
                {
                  type: "annual_fee",
                  amount: 499,
                  message,
                },
              ],
            }
          : s,
      ),
    );

    toast({
      title: "Notice added",
      description: "This one-time message will appear in the monthly report for this statement.",
    });
  };

  const isAutoAudit = autoAuditEligible;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="space-y-2">
          <h1 data-testid="text-upload-title" className="text-3xl font-bold font-heading tracking-tight">
            Statement Intake
          </h1>
          <p data-testid="text-upload-subtitle" className="text-muted-foreground">
            Upload statements for monthly audits. AutoAudit will choose the right processor rule pack and route edge cases to Human Review.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold" data-testid="text-intake-card-title">
                    Statement metadata
                  </p>
                  <p className="text-xs text-muted-foreground">Used to match processor packs and audit rules.</p>
                </div>
                <Badge data-testid="badge-intake-mode" variant="outline" className={isAutoAudit ? "text-accent" : "text-orange-600"}>
                  {isAutoAudit ? "Auto Audit" : "Human Review"}
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="processor">Processor</Label>
                  <Select value={processor} onValueChange={(v) => setProcessor(v as Processor)}>
                    <SelectTrigger data-testid="select-processor" id="processor">
                      <SelectValue placeholder="Select processor" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "CardConnect",
                        "Fiserv",
                        "VersaPay",
                        "Stripe",
                        "Square",
                        "Chase",
                        "Other",
                      ].map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p data-testid="text-processor-pack-note" className="text-xs text-muted-foreground">
                    Findings will be generated using the {processor} rule pack only.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="month">Statement Month</Label>
                    <Input data-testid="input-statement-month" id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="volume">Estimated Volume</Label>
                    <Input
                      data-testid="input-estimated-volume"
                      id="volume"
                      placeholder="$85,000"
                      value={estimatedVolume}
                      onChange={(e) => setEstimatedVolume(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business">Business name</Label>
                  <Input
                    data-testid="input-business-name"
                    id="business"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mid">MID (optional)</Label>
                  <Input data-testid="input-mid" id="mid" value={mid} onChange={(e) => setMid(e.target.value)} />
                  <p className="text-xs text-muted-foreground" data-testid="text-mid-help">
                    Used to detect missing monthly audits and generate exception reports.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    data-testid="checkbox-auto-audit"
                    id="auto-audit"
                    checked={autoAuditEligible}
                    onCheckedChange={(v) => setAutoAuditEligible(Boolean(v))}
                  />
                  <Label htmlFor="auto-audit" className="cursor-pointer">
                    Clear for automatic audit
                  </Label>
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAutoAudit ? "bg-accent/10 text-accent" : "bg-orange-500/10 text-orange-600"}`}>
                      {isAutoAudit ? <Sparkles className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <p data-testid="text-eligibility-title" className="text-sm font-semibold">
                        {eligibleReason}
                      </p>
                      <p data-testid="text-eligibility-desc" className="text-xs text-muted-foreground mt-1">
                        {isAutoAudit
                          ? "AutoAudit will classify fees and produce findings immediately."
                          : "Your team can review unknown fees & special cases before reports are sent."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {sampleQuestions.map((q) => (
                      <div key={q.id} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{q.label}</Label>
                        <Input
                          data-testid={`input-${q.id}`}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          className="h-10"
                        />
                        <p className="text-[11px] text-muted-foreground">{q.hint}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p data-testid="text-unknown-fee-title" className="font-semibold">
                    Unknown fee handling
                  </p>
                  <p className="text-xs text-muted-foreground">Prevent small, valid pass-through fees from becoming red flags.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    data-testid="checkbox-unknown-fee-approval"
                    id="ufe"
                    checked={unknownFeeApprovalEnabled}
                    onCheckedChange={(v) => setUnknownFeeApprovalEnabled(Boolean(v))}
                  />
                  <Label htmlFor="ufe" className="cursor-pointer text-sm">
                    Require approval
                  </Label>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="thr">Approval threshold</Label>
                  <Input
                    data-testid="input-unknown-fee-threshold"
                    id="thr"
                    value={unknownFeeThreshold}
                    onChange={(e) => setUnknownFeeThreshold(e.target.value)}
                    placeholder="$1.00"
                  />
                  <p className="text-xs text-muted-foreground">Fees under this threshold can be auto-approved.</p>
                </div>
                <div className="space-y-2">
                  <Label>Approval role</Label>
                  <div className="h-10 rounded-md border border-border bg-secondary/30 flex items-center px-3 text-sm">
                    <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span data-testid="text-approval-role">Anyone on the team</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Per your note: anyone can approve unknown fees.</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div
              data-testid="dropzone-upload"
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ease-in-out cursor-pointer group ${
                isDragging
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border bg-card hover:bg-secondary/30 hover:border-primary/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                data-testid="input-file"
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept=".pdf,.csv"
                onChange={handleFileSelect}
              />

              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                <UploadCloud className="w-8 h-8 text-primary" />
              </div>

              <h3 data-testid="text-dropzone-title" className="text-xl font-semibold mb-2">
                Upload statement (PDF/CSV)
              </h3>
              <p data-testid="text-dropzone-subtitle" className="text-muted-foreground max-w-md mx-auto mb-6">
                AutoAudit will detect scanned vs. text PDFs, extract relevant pages, normalize fees, then generate findings.
              </p>

              <div className="flex items-center justify-center gap-3">
                <Button data-testid="button-select-files" variant="outline" className="min-w-[140px]">
                  Select Files
                </Button>
                <Button data-testid="button-use-sample" variant="ghost" className="min-w-[140px]" onClick={(e) => {
                  e.stopPropagation();
                  const f = new File(["sample"], "Sample_Statement.pdf", { type: "application/pdf" });
                  handleFiles([f]);
                }}>
                  Use sample
                </Button>
              </div>
            </div>

            {files.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-xs text-muted-foreground" data-testid="text-local-files">
                  Local files added (prototype only)
                </p>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <Card key={index} className="overflow-hidden">
                      <div className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" data-testid={`text-local-file-${index}`}>
                            {file.name}
                          </p>
                          <div className="flex items-center text-xs text-muted-foreground gap-3 mt-1">
                            <span>{(file.size / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span>Added just now</span>
                          </div>
                        </div>

                        <Button
                          data-testid={`button-remove-local-file-${index}`}
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLocalFile(index);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p data-testid="text-history-title" className="font-semibold">
                    Upload history
                  </p>
                  <p className="text-xs text-muted-foreground">Processing status, previews, and one-time notices.</p>
                </div>
                <Badge data-testid="badge-retention" variant="outline" className="text-xs text-muted-foreground">
                  Default retention: 90 days
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                {statements.map((s) => (
                  <div key={s.id} data-testid={`row-statement-${s.id}`} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate" data-testid={`text-statement-filename-${s.id}`}>
                            {s.fileName}
                          </p>
                          <Badge
                            data-testid={`badge-statement-status-${s.id}`}
                            variant="outline"
                            className={
                              s.status === "done"
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : s.status === "review"
                                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                  : "text-muted-foreground"
                            }
                          >
                            {s.status === "done"
                              ? "Audited"
                              : s.status === "review"
                                ? "Human review"
                                : s.status === "processing"
                                  ? "Processing"
                                  : s.status === "uploading"
                                    ? "Uploading"
                                    : "Queued"}
                          </Badge>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          <span data-testid={`text-statement-business-${s.id}`} className="inline-flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" /> {s.businessName}
                          </span>
                          <span className="inline-flex items-center gap-1" data-testid={`text-statement-processor-${s.id}`}>
                            <CreditCard className="w-3.5 h-3.5" /> {s.processor}
                          </span>
                          <span className="inline-flex items-center gap-1" data-testid={`text-statement-month-${s.id}`}>
                            <span className="font-mono">{s.month}</span>
                          </span>
                          {s.mid && (
                            <span className="inline-flex items-center gap-1" data-testid={`text-statement-mid-${s.id}`}>
                              MID: <span className="font-mono">{s.mid}</span>
                            </span>
                          )}
                        </div>

                        {(s.status === "uploading" || s.status === "processing") && (
                          <div className="mt-3">
                            <Progress data-testid={`progress-statement-${s.id}`} value={s.progress} className="h-1.5" />
                            <p className="text-xs text-muted-foreground mt-2">
                              {s.status === "uploading" ? "Uploading file" : "Parsing and normalizing"} • {s.progress}%
                            </p>
                          </div>
                        )}

                        {s.findingsPreview && (s.status === "done" || s.status === "review") && (
                          <div className="mt-3 grid sm:grid-cols-3 gap-3">
                            <div className="rounded-md border border-border bg-secondary/20 p-3">
                              <p className="text-[11px] text-muted-foreground">Potential savings (mo)</p>
                              <p data-testid={`text-preview-savings-${s.id}`} className="font-mono font-semibold text-foreground">
                                ${(s.findingsPreview.potentialSavingsMonthly ?? 0).toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-md border border-border bg-secondary/20 p-3">
                              <p className="text-[11px] text-muted-foreground">Confidence</p>
                              <p data-testid={`text-preview-confidence-${s.id}`} className="font-semibold">
                                {s.findingsPreview.confidence}
                              </p>
                            </div>
                            <div className="rounded-md border border-border bg-secondary/20 p-3">
                              <p className="text-[11px] text-muted-foreground">Unknown fees</p>
                              <p data-testid={`text-preview-unknown-${s.id}`} className="font-semibold">
                                {s.findingsPreview.unknownFees}
                              </p>
                            </div>
                          </div>
                        )}

                        {s.notices && s.notices.length > 0 && (
                          <div className="mt-3 rounded-lg border border-border bg-accent/5 p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold" data-testid={`text-notice-title-${s.id}`}>
                                  Custom notice for this statement
                                </p>
                                {s.notices.map((n, idx) => (
                                  <p
                                    key={idx}
                                    data-testid={`text-notice-${s.id}-${idx}`}
                                    className="text-sm text-muted-foreground mt-1 leading-relaxed"
                                  >
                                    {n.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <Button
                          data-testid={`button-add-annual-fee-notice-${s.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => addAnnualFeeNotice(s.id)}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Add annual fee notice
                        </Button>
                        <Button
                          data-testid={`button-view-findings-${s.id}`}
                          size="sm"
                          variant="default"
                          className="shadow-sm"
                          onClick={() => toast({ title: "Demo", description: "In the prototype, open Findings from the sidebar." })}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          View findings
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="grid md:grid-cols-3 gap-4">
                {[{
                  icon: DollarSign,
                  title: "Built-in bidders (volume tiers)",
                  desc: "Pricing benchmarks can vary by volume. Select a tier during intake.",
                  testid: "card-volume-bidders",
                }, {
                  icon: ShieldCheck,
                  title: "Processor-specific rules",
                  desc: "CardConnect statements use CardConnect bids only (no cross-processor flags).",
                  testid: "card-processor-rules",
                }, {
                  icon: Wand2,
                  title: "Human review queue",
                  desc: "Route statements that need manual approval before reporting.",
                  testid: "card-human-review",
                }].map((item) => (
                  <div key={item.testid} data-testid={item.testid} className="rounded-lg border border-border bg-secondary/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <item.icon className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-sm">{item.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-border bg-secondary/10 p-4">
                <p className="text-sm font-semibold" data-testid="text-amex-note-title">
                  Effective rate handling (AmEx)
                </p>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-amex-note-body">
                  Monthly OER can be computed excluding American Express volume/fees. This can be toggled per client to match the auditing process.
                </p>
              </div>
            </Card>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p data-testid="text-savings-explain-title" className="font-semibold">
                Savings calculations (prototype)
              </p>
              <p data-testid="text-savings-explain-body" className="text-sm text-muted-foreground mt-1 leading-relaxed">
                AutoAudit will show two savings views: DR Savings (difference-to-rate) and OER Savings (effective rate normalization). The UI will include an
                expandable “How we calculated this” panel with assumptions and evidence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
