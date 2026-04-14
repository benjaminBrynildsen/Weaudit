import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldAlert,
  AlertTriangle,
  TrendingDown,
  X,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useAudits, useAudit } from "@/lib/api";

type AuditStatus = "Complete" | "Needs Review" | "In Progress";

type AuditRow = {
  id: string;
  client: string;
  processor: string;
  statementMonth: string;
  mid: string;
  scannedAt: string;
  createdAt: string;
  status: AuditStatus;
};

type Batch = {
  id: string;
  label: string;
  createdAt: string;
  processor: string;
  audits: AuditRow[];
};

function mapApiStatus(status: string): AuditStatus {
  if (status === "complete") return "Complete";
  if (status === "needs_review") return "Needs Review";
  return "In Progress";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function statusBadgeClass(status: AuditStatus) {
  if (status === "Complete") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "Needs Review") return "bg-amber-500/10 text-amber-800 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Group audits created within 60s of each other with same processor into batches
function detectBatches(audits: AuditRow[]): { batches: Batch[]; singles: AuditRow[] } {
  const sorted = [...audits].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const used = new Set<string>();
  const batches: Batch[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    const group: AuditRow[] = [sorted[i]];
    const t0 = new Date(sorted[i].createdAt).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(sorted[j].id)) continue;
      const tj = new Date(sorted[j].createdAt).getTime();
      if (tj - t0 <= 120_000 && sorted[j].processor === sorted[i].processor) {
        group.push(sorted[j]);
      }
    }

    if (group.length >= 2) {
      for (const a of group) used.add(a.id);
      batches.push({
        id: `batch_${sorted[i].id}`,
        label: `${group[0].processor} Batch`,
        createdAt: sorted[i].createdAt,
        processor: sorted[i].processor,
        audits: group,
      });
    }
  }

  const singles = sorted.filter((a) => !used.has(a.id));
  return { batches: batches.reverse(), singles: singles.reverse() };
}

// Audit detail panel component
function AuditDetailPanel({ auditId, onClose }: { auditId: string; onClose: () => void }) {
  const { data: audit, isLoading } = useAudit(auditId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!audit) {
    return <p className="text-sm text-muted-foreground text-center py-8">Audit not found.</p>;
  }

  const allFindings = audit.findings ?? [];
  const nonPci = allFindings.filter((f) => f.type === "non_pci");
  const downgrades = allFindings.filter((f) => f.type === "downgrade");
  const serviceCharges = allFindings.filter((f) => f.type === "service_charge");
  // Show unknown findings that have interchange rates as "Interchange Lines"
  const interchange = allFindings.filter((f) => f.type === "unknown" && f.rate > 0);
  const overcharged = serviceCharges.filter((f) => f.spread != null && f.spread > 0);
  const nonPciTotal = nonPci.reduce((s, f) => s + f.amount, 0);
  const downgradeSpread = downgrades.reduce((s, f) => s + (f.spread ?? 0), 0);
  // Actionable findings only — interchange lines are informational, shown in badge count above
  const findings = [...nonPci, ...downgrades, ...serviceCharges];

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Client / DBA</p>
          <p className="text-sm font-medium mt-1">{audit.dba || audit.clientName}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">MID</p>
          <p className="font-mono text-sm mt-1">{audit.mid || "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Processor</p>
          <p className="text-sm mt-1">{audit.processorDetected || audit.processor}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Period</p>
          <p className="text-sm mt-1">{audit.statementPeriod || audit.statementMonth || "—"}</p>
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Volume</p>
          <p className="font-mono text-sm mt-1">{audit.totalVolume != null ? money(audit.totalVolume) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Total Fees</p>
          <p className="font-mono text-sm mt-1">{audit.totalFees != null ? money(audit.totalFees) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/10 p-3">
          <p className="text-[11px] text-muted-foreground">Effective Rate</p>
          <p className="font-mono text-sm mt-1">{audit.effectiveRate != null ? `${(audit.effectiveRate * 100).toFixed(2)}%` : "—"}</p>
        </div>
      </div>

      {/* Findings summary */}
      {findings.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Findings</p>
            <div className="flex items-center gap-2 flex-wrap">
              {nonPci.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-medium text-red-600">{nonPci.length} Non-PCI</span>
                  <span className="text-xs text-red-600/70 font-mono">{money(nonPciTotal)}</span>
                </div>
              )}
              {downgrades.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-yellow-400/10 border border-yellow-500/20">
                  <TrendingDown className="w-3.5 h-3.5 text-yellow-700" />
                  <span className="text-xs font-medium text-yellow-700">{downgrades.length} Downgrades</span>
                  {downgradeSpread > 0 && (
                    <span className="text-xs text-yellow-700/70 font-mono">{money(downgradeSpread)}</span>
                  )}
                </div>
              )}
              {serviceCharges.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/20">
                  <span className="text-xs font-medium text-violet-600">
                    {serviceCharges.length} Service Charges
                    {overcharged.length > 0 && <span className="text-violet-600/70"> ({overcharged.length} over)</span>}
                  </span>
                </div>
              )}
              {interchange.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                  <span className="text-xs font-medium text-sky-600">{interchange.length} Interchange Lines</span>
                </div>
              )}
            </div>

            {/* Top findings list */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="divide-y divide-border max-h-[300px] overflow-auto">
                {findings
                  .slice()
                  .sort((a, b) => {
                    const sev = { High: 0, Medium: 1, Low: 2 };
                    return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
                  })
                  .slice(0, 15)
                  .map((f) => {
                    const bgClass =
                      f.type === "non_pci"
                        ? "bg-red-500/5"
                        : f.type === "downgrade"
                          ? "bg-yellow-400/5"
                          : f.type === "service_charge"
                            ? "bg-violet-500/5"
                            : "bg-sky-500/5";
                    return (
                      <div key={f.findingId} className={`px-3 py-2 ${bgClass}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{f.rawLine || f.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              p.{f.page} &middot; {f.reason || f.category}
                            </p>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <span className="font-mono text-xs">{money(f.amount)}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                f.type === "non_pci"
                                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                                  : f.type === "downgrade"
                                    ? "bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                                    : f.type === "service_charge"
                                      ? "bg-violet-500/10 text-violet-600 border-violet-500/20"
                                      : "bg-sky-500/10 text-sky-600 border-sky-500/20"
                              }`}
                            >
                              {f.type === "non_pci" ? "Non-PCI" : f.type === "downgrade" ? "Downgrade" : f.type === "service_charge" ? "Svc Charge" : "Interchange"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button
          className="flex-1"
          onClick={() => {
            window.location.href = `/report?auditId=${auditId}`;
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

export default function History() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "recovery" | "flags">("recent");
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const { data: audits, isLoading } = useAudits();

  const mappedAudits: AuditRow[] = useMemo(() => {
    if (!audits) return [];
    return audits.map((a) => ({
      id: a.auditId,
      client: a.clientName,
      processor: a.processor,
      statementMonth: a.statementMonth,
      mid: a.mid,
      scannedAt: formatDate(a.createdAt),
      createdAt: a.createdAt,
      status: mapApiStatus(a.status),
    }));
  }, [audits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mappedAudits.filter((r) => {
      if (!q) return true;
      const hay = `${r.client} ${r.processor} ${r.statementMonth} ${r.mid} ${r.status}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, mappedAudits]);

  const { batches, singles } = useMemo(() => detectBatches(filtered), [filtered]);

  const toggleBatch = (batchId: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  function AuditTableRow({ r }: { r: AuditRow }) {
    return (
      <TableRow
        key={r.id}
        data-testid={`row-audit-${r.id}`}
        className="cursor-pointer hover:bg-secondary/20"
        onClick={() => setSelectedAuditId(r.id)}
      >
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Audit actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedAuditId(r.id)}>
                <ExternalLink className="w-4 h-4 mr-2" /> View details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = `/report?auditId=${r.id}`;
                }}
              >
                <FileText className="w-4 h-4 mr-2" /> Generate report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
        <TableCell>
          <div className="min-w-0">
            <p className="font-semibold truncate">{r.client}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{r.mid || "—"}</p>
          </div>
        </TableCell>
        <TableCell>
          <p className="font-mono text-sm">{r.statementMonth}</p>
        </TableCell>
        <TableCell>
          <p className="text-sm">{r.processor}</p>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <p className="text-sm text-muted-foreground">{r.scannedAt}</p>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={statusBadgeClass(r.status)}>
            {r.status === "Complete" ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </span>
            ) : r.status === "Needs Review" ? (
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Needs review
              </span>
            ) : (
              "In progress"
            )}
          </Badge>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold font-heading tracking-tight">Audit History</h1>
            <p className="text-muted-foreground mt-1">
              All previous statement audits. Click any row to see details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="shadow-lg shadow-primary/20"
              onClick={() => { window.location.href = "/dashboard"; }}
            >
              <FileText className="w-4 h-4 mr-2" /> New audit
            </Button>
          </div>
        </div>

        {/* Batches section */}
        {batches.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Batch Audits</p>
                <Badge variant="outline" className="text-xs">{batches.length} batch{batches.length !== 1 ? "es" : ""}</Badge>
              </div>
            </div>
            <div className="divide-y divide-border">
              {batches.map((batch) => {
                const isOpen = expandedBatches.has(batch.id);
                const done = batch.audits.filter((a) => a.status === "Complete" || a.status === "Needs Review").length;
                return (
                  <div key={batch.id}>
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors"
                      onClick={() => toggleBatch(batch.id)}
                    >
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{batch.label}</p>
                          <Badge variant="outline" className="text-[11px]">
                            {batch.audits.length} files
                          </Badge>
                          <Badge variant="outline" className={`text-[11px] ${done === batch.audits.length ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}`}>
                            {done}/{batch.audits.length} done
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(batch.createdAt)} at {formatTime(batch.createdAt)}
                        </p>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Client</TableHead>
                              <TableHead>Statement</TableHead>
                              <TableHead>Processor</TableHead>
                              <TableHead className="hidden md:table-cell">Scanned</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {batch.audits.map((r) => (
                              <AuditTableRow key={r.id} r={r} />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Individual audits */}
        <Card className="p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {batches.length > 0 ? "Individual Audits" : "All Audits"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Click any audit to see full details and findings.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search client, MID, processor…"
                  className="pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    <span className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort: {sort === "recent" ? "Most recent" : sort === "recovery" ? "Recovery" : "Most flags"}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sort audits</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSort("recent")}>Most recent</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort("recovery")}>Highest recovery</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSort("flags")}>Most flags</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-5 flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading audits...</span>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Statement</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead className="hidden md:table-cell">Scanned</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {singles.map((r) => (
                    <AuditTableRow key={r.id} r={r} />
                  ))}

                  {singles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="py-12 text-center">
                          <p className="text-sm font-semibold">
                            {mappedAudits.length === 0 ? "No audits yet" : "No audits match your search"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {mappedAudits.length === 0 ? "Upload a statement to get started." : "Try a different keyword."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Audit Detail Dialog */}
      <Dialog open={!!selectedAuditId} onOpenChange={(open) => !open && setSelectedAuditId(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Details</DialogTitle>
            <DialogDescription className="text-xs font-mono">{selectedAuditId}</DialogDescription>
          </DialogHeader>
          {selectedAuditId && (
            <AuditDetailPanel auditId={selectedAuditId} onClose={() => setSelectedAuditId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
