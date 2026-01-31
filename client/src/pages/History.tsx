import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ExternalLink,
  FileText,
  MoreHorizontal,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

type AuditStatus = "Complete" | "Needs Review" | "In Progress";

type AuditRow = {
  id: string;
  client: string;
  processor: string;
  statementMonth: string;
  mid: string;
  scannedAt: string;
  status: AuditStatus;
  nonPci: number;
  downgrades: number;
  estRecovery: number;
};

const initialAudits: AuditRow[] = [
  {
    id: "a-001",
    client: "Patriot Flooring Supplies",
    processor: "CardConnect",
    statementMonth: "2025-12",
    mid: "737191920880",
    scannedAt: "Jan 28, 2026",
    status: "Needs Review",
    nonPci: 1,
    downgrades: 3,
    estRecovery: 319.15,
  },
  {
    id: "a-002",
    client: "Sunset Dental",
    processor: "VersaPay",
    statementMonth: "2025-11",
    mid: "MID-0017740",
    scannedAt: "Jan 18, 2026",
    status: "Complete",
    nonPci: 0,
    downgrades: 2,
    estRecovery: 96.55,
  },
  {
    id: "a-003",
    client: "Northside Auto",
    processor: "Fiserv",
    statementMonth: "2025-10",
    mid: "MID-0081144",
    scannedAt: "Jan 09, 2026",
    status: "Complete",
    nonPci: 2,
    downgrades: 5,
    estRecovery: 742.8,
  },
  {
    id: "a-004",
    client: "Acme Coffee Roasters",
    processor: "CardConnect",
    statementMonth: "2025-09",
    mid: "MID-0042187",
    scannedAt: "Dec 21, 2025",
    status: "Complete",
    nonPci: 1,
    downgrades: 0,
    estRecovery: 129,
  },
  {
    id: "a-005",
    client: "Lakeside Wellness",
    processor: "Wells Fargo",
    statementMonth: "2025-08",
    mid: "MID-0099912",
    scannedAt: "Dec 02, 2025",
    status: "In Progress",
    nonPci: 0,
    downgrades: 1,
    estRecovery: 41.12,
  },
];

function statusBadgeClass(status: AuditStatus) {
  if (status === "Complete") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "Needs Review") return "bg-amber-500/10 text-amber-800 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function History() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "recovery" | "flags">("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = initialAudits.filter((r) => {
      if (!q) return true;
      const hay = `${r.client} ${r.processor} ${r.statementMonth} ${r.mid} ${r.status}`.toLowerCase();
      return hay.includes(q);
    });

    if (sort === "recovery") out = [...out].sort((a, b) => b.estRecovery - a.estRecovery);
    if (sort === "flags") out = [...out].sort((a, b) => (b.nonPci + b.downgrades) - (a.nonPci + a.downgrades));
    if (sort === "recent") out = out; // already ordered in mock data

    return out;
  }, [query, sort]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 data-testid="text-history-title" className="text-3xl font-bold font-heading tracking-tight">
              Audit History
            </h1>
            <p data-testid="text-history-subtitle" className="text-muted-foreground mt-1">
              All previous statement audits, searchable and sortable.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              data-testid="button-history-new-audit"
              className="shadow-lg shadow-primary/20"
              onClick={() => {
                window.location.href = "/dashboard";
              }}
            >
              <FileText className="w-4 h-4 mr-2" /> New audit
            </Button>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <p data-testid="text-history-scope-title" className="text-sm font-semibold">
                History workspace
              </p>
              <p data-testid="text-history-scope-body" className="text-xs text-muted-foreground mt-1">
                Click an audit to reopen the workspace and review evidence.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-history-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search client, MID, processor…"
                  className="pl-9"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="button-history-sort" variant="outline" className="justify-between">
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
                  <DropdownMenuItem data-testid="option-sort-recent" onClick={() => setSort("recent")}>
                    Most recent
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="option-sort-recovery" onClick={() => setSort("recovery")}>
                    Highest recovery
                  </DropdownMenuItem>
                  <DropdownMenuItem data-testid="option-sort-flags" onClick={() => setSort("flags")}>
                    Most flags
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Statement</TableHead>
                  <TableHead>Processor</TableHead>
                  <TableHead className="hidden lg:table-cell">MID</TableHead>
                  <TableHead className="hidden md:table-cell">Scanned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Flags</TableHead>
                  <TableHead className="text-right">Est. recovery</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    data-testid={`row-audit-${r.id}`}
                    className="cursor-pointer hover:bg-secondary/20"
                    onClick={() => {
                      window.location.href = "/dashboard";
                    }}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <p data-testid={`text-audit-client-${r.id}`} className="font-semibold truncate">
                          {r.client}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarClock className="w-3.5 h-3.5" />
                          <span data-testid={`text-audit-id-${r.id}`}>{r.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p data-testid={`text-audit-month-${r.id}`} className="font-mono text-sm">
                        {r.statementMonth}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p data-testid={`text-audit-processor-${r.id}`} className="text-sm">
                        {r.processor}
                      </p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p data-testid={`text-audit-mid-${r.id}`} className="font-mono text-sm text-muted-foreground">
                        {r.mid}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p data-testid={`text-audit-scanned-${r.id}`} className="text-sm text-muted-foreground">
                        {r.scannedAt}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge data-testid={`badge-audit-status-${r.id}`} variant="outline" className={statusBadgeClass(r.status)}>
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
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <Badge
                          data-testid={`badge-audit-nonpci-${r.id}`}
                          variant="outline"
                          className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20"
                        >
                          {r.nonPci} red
                        </Badge>
                        <Badge
                          data-testid={`badge-audit-downgrades-${r.id}`}
                          variant="outline"
                          className="text-[11px] bg-yellow-400/15 text-yellow-700 border-yellow-500/20"
                        >
                          {r.downgrades} yellow
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p data-testid={`text-audit-recovery-${r.id}`} className="font-mono text-sm">
                        {money(r.estRecovery)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            data-testid={`button-audit-actions-${r.id}`}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuLabel>Audit actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            data-testid={`action-open-audit-${r.id}`}
                            onClick={() => {
                              window.location.href = "/dashboard";
                            }}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" /> Open
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            data-testid={`action-download-audit-${r.id}`}
                            onClick={() => {
                              const qs = new URLSearchParams({
                                auditId: r.id,
                                client: r.client,
                                processor: r.processor,
                                statementMonth: r.statementMonth,
                                mid: r.mid,
                                status: r.status,
                                nonPci: String(r.nonPci),
                                downgrades: String(r.downgrades),
                                estRecovery: String(r.estRecovery),
                              });
                              window.location.href = `/report?${qs.toString()}`;
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" /> Download audit
                          </DropdownMenuItem>

                          <DropdownMenuItem data-testid={`action-duplicate-audit-${r.id}`}>Duplicate (mock)</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem data-testid={`action-delete-audit-${r.id}`} className="text-destructive">
                            Delete (mock)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <div className="py-12 text-center">
                        <p data-testid="text-history-empty" className="text-sm font-semibold">
                          No audits match your search
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Try a different keyword.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
