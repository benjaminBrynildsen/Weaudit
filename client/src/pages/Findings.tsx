import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  FileText,
  ShieldAlert,
  CreditCard,
  Banknote,
  FileWarning,
  Landmark,
  Scale,
  Sparkles,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAudits, useFindings, useUpdateFinding, Finding as ApiFinding } from "@/lib/api";

type FindingStatus = "Open" | "Acknowledged" | "Resolved" | "False Positive";

type Finding = {
  id: string;
  findingId: string;
  title: string;
  category:
    | "Pricing Model"
    | "Processor Markup"
    | "Junk Fees"
    | "PCI & Compliance"
    | "Gateway"
    | "Contract Risk";
  processor: string;
  date: string;
  impactMonthly: number;
  severity: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  status: FindingStatus;
  rate?: number;
  targetRate?: number;
  spread?: number;
  evidence: Array<{ page: number; line: number; raw: string; amount: number; mapped: string; confidence: number }>;
  explain: { whatItIs: string; whyFlagged: string; recommendedAction: string };
};

function mapApiStatus(status: ApiFinding["status"]): FindingStatus {
  switch (status) {
    case "open": return "Open";
    case "acknowledged": return "Acknowledged";
    case "resolved": return "Resolved";
    case "false_positive": return "False Positive";
    default: return "Open";
  }
}

function mapApiCategory(category: string): Finding["category"] {
  const valid: Finding["category"][] = [
    "Pricing Model",
    "Processor Markup",
    "Junk Fees",
    "PCI & Compliance",
    "Gateway",
    "Contract Risk",
  ];
  if (valid.includes(category as Finding["category"])) {
    return category as Finding["category"];
  }
  // Fallback mapping for API categories that don't match exactly
  const lower = category.toLowerCase();
  if (lower.includes("pci") || lower.includes("compliance")) return "PCI & Compliance";
  if (lower.includes("pricing") || lower.includes("downgrade") || lower.includes("tiered")) return "Pricing Model";
  if (lower.includes("markup") || lower.includes("processor")) return "Processor Markup";
  if (lower.includes("junk") || lower.includes("hidden") || lower.includes("annual") || lower.includes("fee")) return "Junk Fees";
  if (lower.includes("gateway")) return "Gateway";
  if (lower.includes("contract") || lower.includes("risk")) return "Contract Risk";
  return "Junk Fees"; // default fallback
}

function mapApiFindingToUi(f: ApiFinding, processor: string, statementMonth: string): Finding {
  return {
    id: f.findingId,
    findingId: f.findingId,
    title: f.title,
    category: mapApiCategory(f.category),
    processor,
    date: statementMonth,
    impactMonthly: f.amount ?? 0,
    severity: f.severity,
    confidence: f.confidence,
    status: mapApiStatus(f.status),
    rate: f.rate,
    targetRate: f.targetRate,
    spread: f.spread,
    evidence: [
      {
        page: f.page ?? 0,
        line: f.lineNum ?? 0,
        raw: f.rawLine ?? "",
        amount: f.amount ?? 0,
        mapped: f.category,
        confidence: f.confidence === "High" ? 0.92 : f.confidence === "Medium" ? 0.71 : 0.42,
      },
    ],
    explain: {
      whatItIs: f.reason ?? "",
      whyFlagged: f.reason ?? "",
      recommendedAction: f.recommendedAction ?? "",
    },
  };
}

const categories = [
  { id: "all", label: "All Findings", icon: FileText },
  { id: "Pricing Model", label: "Pricing Model", icon: Scale },
  { id: "Processor Markup", label: "Processor Markup", icon: Banknote },
  { id: "Junk Fees", label: "Junk / Hidden", icon: FileWarning },
  { id: "PCI & Compliance", label: "PCI & Compliance", icon: ShieldAlert },
  { id: "Gateway", label: "Gateway", icon: CreditCard },
  { id: "Contract Risk", label: "Contract Risk", icon: Landmark },
];

function severityBadgeClass(sev: Finding["severity"]) {
  if (sev === "High") return "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20";
  if (sev === "Medium") return "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/20";
  return "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20";
}

function confidenceBadgeClass(conf: Finding["confidence"]) {
  if (conf === "High") return "bg-green-500/10 text-green-600 border-green-500/20";
  if (conf === "Medium") return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
  return "bg-muted text-muted-foreground border-border";
}

export default function Findings() {
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedAuditId, setSelectedAuditId] = useState<string | undefined>(undefined);

  // Fetch all audits to populate the audit selector
  const { data: audits, isLoading: auditsLoading } = useAudits();

  // Auto-select the first (most recent) audit when audits load
  useEffect(() => {
    if (audits && audits.length > 0 && !selectedAuditId) {
      setSelectedAuditId(audits[0].auditId);
    }
  }, [audits, selectedAuditId]);

  // Fetch findings for the selected audit
  const { data: apiFindings, isLoading: findingsLoading } = useFindings(selectedAuditId);

  // Mutation for updating finding status
  const updateFinding = useUpdateFinding();

  // Look up the selected audit for processor / statement month info
  const selectedAudit = useMemo(
    () => audits?.find((a) => a.auditId === selectedAuditId),
    [audits, selectedAuditId],
  );

  // Map API findings to UI findings
  const findings: Finding[] = useMemo(() => {
    if (!apiFindings) return [];
    const processor = selectedAudit?.processor ?? selectedAudit?.processorDetected ?? "Unknown";
    const month = selectedAudit?.statementMonth ?? "";
    return apiFindings.map((f) => mapApiFindingToUi(f, processor, month));
  }, [apiFindings, selectedAudit]);

  const filteredFindings = useMemo(() => {
    if (activeTab === "all") return findings;
    return findings.filter((f) => f.category === (activeTab as Finding["category"]));
  }, [activeTab, findings]);

  const isLoading = auditsLoading || findingsLoading;

  // Handler for "Mark as Resolved"
  function handleMarkResolved(finding: Finding) {
    updateFinding.mutate(
      { findingId: finding.findingId, status: "resolved" },
      {
        onSuccess: () => {
          setSelectedFinding((prev) =>
            prev && prev.id === finding.id ? { ...prev, status: "Resolved" } : prev,
          );
        },
      },
    );
  }

  // Handler for "Mark False Positive"
  function handleMarkFalsePositive(finding: Finding) {
    updateFinding.mutate(
      { findingId: finding.findingId, status: "false_positive" },
      {
        onSuccess: () => {
          setSelectedFinding((prev) =>
            prev && prev.id === finding.id ? { ...prev, status: "False Positive" } : prev,
          );
        },
      },
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 data-testid="text-findings-title" className="text-3xl font-bold font-heading tracking-tight">
              Findings & Audit
            </h1>
            <p data-testid="text-findings-subtitle" className="text-muted-foreground mt-1">
              Processor-specific flags, unknown fee approvals, and explainable evidence.
            </p>
          </div>
          <div className="flex gap-2">
            {audits && audits.length > 1 && (
              <Select value={selectedAuditId} onValueChange={setSelectedAuditId}>
                <SelectTrigger data-testid="select-audit" className="w-[220px]">
                  <SelectValue placeholder="Select Audit" />
                </SelectTrigger>
                <SelectContent>
                  {audits.map((a) => (
                    <SelectItem key={a.auditId} value={a.auditId}>
                      {a.clientName} - {a.statementMonth}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button data-testid="button-export-report" variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <p data-testid="text-processor-scope" className="text-sm font-semibold">
                Scope: Processor-specific rule packs
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedAudit
                  ? `Showing findings for ${selectedAudit.processor ?? selectedAudit.processorDetected ?? "Unknown"} statement.`
                  : "CardConnect findings won't be compared against other processors' bids."}
              </p>
            </div>
            <Badge data-testid="badge-scope" variant="outline" className="text-muted-foreground">
              {selectedAudit
                ? `Processor: ${selectedAudit.processor ?? selectedAudit.processorDetected ?? "Unknown"}`
                : "Active packs: CardConnect, Fiserv, VersaPay"}
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading findings...</span>
          </div>
        ) : (
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-transparent gap-1 border-b border-border rounded-none mb-6 no-scrollbar">
              {categories.map((cat) => (
                <TabsTrigger
                  data-testid={`tab-category-${cat.id.replace(/\s+/g, "-").toLowerCase()}`}
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-border border border-transparent px-4 py-2"
                >
                  <cat.icon className="w-4 h-4 mr-2" />
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-card rounded-lg border border-border shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input data-testid="input-findings-search" placeholder="Search findings..." className="pl-9 border-border bg-background" />
                </div>
                <Select defaultValue="all">
                  <SelectTrigger data-testid="select-severity" className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="High">High Impact</SelectItem>
                    <SelectItem value="Medium">Medium Impact</SelectItem>
                    <SelectItem value="Low">Low Impact</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all_status">
                  <SelectTrigger data-testid="select-status" className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_status">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="False Positive">False Positive</SelectItem>
                  </SelectContent>
                </Select>
                <Button data-testid="button-more-filters" variant="ghost" size="icon" className="shrink-0">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-secondary/30">
                    <TableRow>
                      <TableHead className="w-[320px]">Finding</TableHead>
                      <TableHead>Processor</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1 cursor-pointer hover:text-foreground" data-testid="button-sort-impact">
                          Impact <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFindings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground" data-testid="text-empty-findings">
                          No findings in this category.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFindings.map((f) => (
                        <TableRow
                          key={f.id}
                          className="group cursor-pointer hover:bg-secondary/20"
                          onClick={() => setSelectedFinding(f)}
                          data-testid={`row-finding-${f.id}`}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-1.5 rounded-full ${
                                  f.severity === "High"
                                    ? "bg-destructive/10 text-destructive"
                                    : f.severity === "Medium"
                                      ? "bg-orange-500/10 text-orange-600"
                                      : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground" data-testid={`text-finding-title-${f.id}`}>
                                  {f.title}
                                </div>
                                <div className="text-xs text-muted-foreground">{f.category} • {f.date}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge data-testid={`badge-finding-processor-${f.id}`} variant="outline" className="font-normal text-muted-foreground">
                              {f.processor}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono font-medium text-foreground">
                            ${f.impactMonthly.toFixed(2)}
                            <span className="text-xs text-muted-foreground font-sans ml-1">/mo</span>
                          </TableCell>
                          <TableCell>
                            <Badge data-testid={`badge-finding-severity-${f.id}`} variant="outline" className={severityBadgeClass(f.severity)}>
                              {f.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge data-testid={`badge-finding-confidence-${f.id}`} variant="outline" className={confidenceBadgeClass(f.confidence)}>
                              {f.confidence}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span data-testid={`text-finding-status-${f.id}`} className="text-sm">
                              {f.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              data-testid={`button-review-finding-${f.id}`}
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Review <ChevronRight className="ml-1 w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p data-testid="text-unknown-approval-note-title" className="font-semibold">
                      Unknown fee approvals
                    </p>
                    <p data-testid="text-unknown-approval-note-body" className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Before a monthly report is finalized, small unknown fees can be approved as valid pass-throughs. This prevents "fees do not match" from
                      triggering unnecessarily.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Sheet open={!!selectedFinding} onOpenChange={(open) => (!open ? setSelectedFinding(null) : null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedFinding && (
            <div className="space-y-8 pt-6">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge data-testid="badge-detail-severity" variant="outline" className={severityBadgeClass(selectedFinding.severity)}>
                    {selectedFinding.severity.toUpperCase()} SEVERITY
                  </Badge>
                  <Badge data-testid="badge-detail-confidence" variant="outline" className={confidenceBadgeClass(selectedFinding.confidence)}>
                    Confidence: {selectedFinding.confidence}
                  </Badge>
                  <Badge data-testid="badge-detail-processor" variant="outline" className="text-muted-foreground">
                    {selectedFinding.processor}
                  </Badge>
                </div>

                <h2 data-testid="text-detail-title" className="text-2xl font-bold font-heading">
                  {selectedFinding.title}
                </h2>
                <p data-testid="text-detail-subtitle" className="text-muted-foreground">
                  Detected in {selectedFinding.processor} statement • {selectedFinding.date}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1">Monthly Impact</div>
                  <div data-testid="text-detail-monthly-impact" className="text-2xl font-bold font-mono text-destructive">
                    -${selectedFinding.impactMonthly.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1">Annualized</div>
                  <div data-testid="text-detail-annual-impact" className="text-2xl font-bold font-mono text-foreground">
                    -${(selectedFinding.impactMonthly * 12).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Show rate details for downgrades */}
              {selectedFinding.category === "Pricing Model" && (selectedFinding.rate != null || selectedFinding.targetRate != null) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedFinding.rate != null && (
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                      <div className="text-sm text-muted-foreground mb-1">Current Rate</div>
                      <div data-testid="text-detail-current-rate" className="text-2xl font-bold font-mono text-destructive">
                        {selectedFinding.rate.toFixed(2)}%
                      </div>
                    </div>
                  )}
                  {selectedFinding.targetRate != null && (
                    <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                      <div className="text-sm text-muted-foreground mb-1">Target Rate (if corrected)</div>
                      <div data-testid="text-detail-target-rate" className="text-2xl font-bold font-mono text-green-600">
                        {selectedFinding.targetRate.toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold text-lg" data-testid="text-explain-title">
                  Explain this fee
                </h3>
                <div className="grid gap-3">
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">What it is</p>
                    <p data-testid="text-explain-what" className="text-sm mt-1">
                      {selectedFinding.explain.whatItIs}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Why it was flagged</p>
                    <p data-testid="text-explain-why" className="text-sm mt-1">
                      {selectedFinding.explain.whyFlagged}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Recommended action</p>
                    <p data-testid="text-explain-action" className="text-sm mt-1">
                      {selectedFinding.explain.recommendedAction}
                    </p>
                  </div>
                </div>

                <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Evidence
                  </h4>
                  <div className="space-y-2">
                    {selectedFinding.evidence.map((e, idx) => (
                      <div
                        key={idx}
                        data-testid={`row-evidence-${idx}`}
                        className="font-mono text-xs bg-background p-3 rounded border border-border text-muted-foreground"
                      >
                        Page {e.page} • Line {e.line} • Confidence {(e.confidence * 100).toFixed(0)}%
                        <div className="mt-2 text-foreground">{e.raw}</div>
                        <div className="mt-2 text-muted-foreground">
                          Mapped: <span className="text-foreground">{e.mapped}</span> • Amount: ${e.amount.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedFinding.category === "Gateway" && selectedFinding.severity === "Low" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <h3 className="font-semibold text-lg">Unknown fee decision</h3>
                  <p className="text-sm text-muted-foreground">
                    Approve this micro-fee as valid pass-through before the audit report is finalized.
                  </p>
                  <div className="flex gap-3">
                    <Button data-testid="button-approve-unknown-fee" className="flex-1">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                    </Button>
                    <Button data-testid="button-escalate-unknown-fee" variant="outline" className="flex-1">
                      Escalate
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-6">
                <Button
                  data-testid="button-mark-resolved"
                  className="flex-1"
                  disabled={updateFinding.isPending || selectedFinding.status === "Resolved"}
                  onClick={() => handleMarkResolved(selectedFinding)}
                >
                  {updateFinding.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Mark as Resolved
                </Button>
                <Button
                  data-testid="button-mark-false-positive"
                  variant="outline"
                  className="flex-1"
                  disabled={updateFinding.isPending || selectedFinding.status === "False Positive"}
                  onClick={() => handleMarkFalsePositive(selectedFinding)}
                >
                  {updateFinding.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Mark False Positive
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
