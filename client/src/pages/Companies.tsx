import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useAudits,
} from "@/lib/api";
import type { Company, Audit } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, Building2, ArrowUpDown, History, FileText, ExternalLink, Download, CloudUpload } from "lucide-react";
import { uploadToDrive } from "@/lib/google-drive";

type SortField = "name" | "riskLevel" | "adjustedEffectiveRate";
type SortDir = "asc" | "desc";

const EMPTY_FORM: Omit<Company, "companyId" | "createdAt" | "updatedAt"> = {
  name: "",
  mid: "",
  auditLevel: "Level II",
  auditor: "",
  paymentMethod: "",
  csm: "",
  csmPhone: "",
  sendTo: "",
  discountRate: 0,
  transactionFee: 0,
  amexFee: 0,
  statementFee: 0,
  avsFee: 0,
  regFee: 0,
  chargebackFee: 0,
  authFee: 0,
  annualFee: 0,
  monitoringFee: 0,
  pciFee: 0,
  gateway: "",
  gatewayFee: 0,
  gatewayTransFee: 0,
  processor: "",
  statementObtainMethod: "",
  password: "",
  validationStatus: "",
  riskLevel: "",
  adjustedEffectiveRate: 0,
  actualOldEffectiveRate: 0,
  taxExempt: false,
};

function riskBadge(level: string) {
  if (level.toLowerCase().startsWith("green")) {
    return (
      <Badge variant="outline" className="text-[11px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        {level}
      </Badge>
    );
  }
  if (level.toLowerCase().startsWith("yellow")) {
    return (
      <Badge variant="outline" className="text-[11px] bg-yellow-400/15 text-yellow-700 border-yellow-400/30">
        {level}
      </Badge>
    );
  }
  if (level.toLowerCase().startsWith("red")) {
    return (
      <Badge variant="outline" className="text-[11px] bg-red-500/10 text-red-600 border-red-500/20">
        {level}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px] text-muted-foreground">
      {level || "—"}
    </Badge>
  );
}

export default function Companies() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: audits = [] } = useAudits();
  const createMutation = useCreateCompany();
  const updateMutation = useUpdateCompany();
  const deleteMutation = useDeleteCompany();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [historyCompany, setHistoryCompany] = useState<Company | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  const companyAudits = useMemo(() => {
    if (!historyCompany?.mid) return [];
    const companyMid = historyCompany.mid.replace(/\D/g, "");
    if (!companyMid) return [];
    return audits
      .filter((a) => {
        const auditMid = (a.mid || "").replace(/\D/g, "");
        return auditMid === companyMid || auditMid.endsWith(companyMid) || companyMid.endsWith(auditMid);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [historyCompany, audits]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = companies;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.mid || "").toLowerCase().includes(q) ||
          c.processor.toLowerCase().includes(q) ||
          c.csm.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "riskLevel") cmp = (a.riskLevel || "").localeCompare(b.riskLevel || "");
      else if (sortField === "adjustedEffectiveRate") cmp = (a.adjustedEffectiveRate || 0) - (b.adjustedEffectiveRate || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [companies, searchQuery, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const buildCsv = () => {
    const headers = [
      "Name", "MID", "Audit Level", "Auditor", "Payment Method",
      "CSM", "CSM Phone", "Send To",
      "Discount", "Transaction Fee", "Amex Fee", "Statement Fee",
      "AVS Fee", "Reg Fee", "Chargeback Fee", "Auth Fee",
      "Annual Fee", "Monitoring Fee", "PCI Fee",
      "Gateway", "Gateway Fee", "Gateway Trans Fee",
      "Processor", "Statement Obtain Method",
      "Validation Status", "Risk Level",
      "Adjusted Eff. Rate", "Actual Old Eff. Rate",
    ];
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = companies.map((c) => [
      c.name, c.mid, c.auditLevel, c.auditor, c.paymentMethod,
      c.csm, c.csmPhone, c.sendTo,
      c.discountRate, c.transactionFee, c.amexFee, c.statementFee,
      c.avsFee, c.regFee, c.chargebackFee, c.authFee,
      c.annualFee, c.monitoringFee, c.pciFee,
      c.gateway, c.gatewayFee, c.gatewayTransFee,
      c.processor, c.statementObtainMethod,
      c.validationStatus, c.riskLevel,
      c.adjustedEffectiveRate, c.actualOldEffectiveRate,
    ].map(escape).join(","));

    return [headers.map(escape).join(","), ...rows].join("\n");
  };

  const exportCsv = () => {
    const csv = buildCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weaudit-companies-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const backupToDrive = async () => {
    setBackingUp(true);
    try {
      const csv = buildCsv();
      const fileName = `weaudit-companies-${new Date().toISOString().slice(0, 10)}.csv`;
      const { webViewLink } = await uploadToDrive(fileName, csv);
      toast({
        title: "Backed up to Google Drive",
        description: (
          <a href={webViewLink} target="_blank" rel="noopener noreferrer" className="underline">
            Open in Drive
          </a>
        ),
      });
    } catch (err: any) {
      toast({
        title: "Drive backup failed",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setBackingUp(false);
    }
  };

  // Form helpers
  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setEditingCompany(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingCompany(company);
    const { companyId, createdAt, updatedAt, ...rest } = company;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingCompany) {
      updateMutation.mutate(
        { companyId: editingCompany.companyId, ...form },
        {
          onSuccess: () => {
            toast({ title: "Company updated" });
            setDialogOpen(false);
          },
        }
      );
    } else {
      createMutation.mutate(form, {
        onSuccess: () => {
          toast({ title: "Company created" });
          setDialogOpen(false);
        },
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.companyId, {
      onSuccess: () => {
        toast({ title: "Company deleted" });
        setDeleteTarget(null);
      },
    });
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold font-heading tracking-tight">Companies</h1>
            <p className="text-muted-foreground mt-1">
              Manage client companies and their contracted service-charge rates.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground">
              {companies.length} {companies.length === 1 ? "company" : "companies"}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={companies.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={backupToDrive} disabled={companies.length === 0 || backingUp}>
              <CloudUpload className="w-4 h-4 mr-2" /> {backingUp ? "Uploading..." : "Google Drive"}
            </Button>
          </div>
        </div>

        {/* Search + Add */}
        <Card className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, processor, CSM..."
                className="pl-9"
              />
            </div>
            <Button onClick={openCreate} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" /> Add Company
            </Button>
          </div>

          <Separator className="my-4" />

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="w-6 h-6" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold mt-3">
                {companies.length === 0 ? "No companies yet" : "No companies found"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {companies.length === 0
                  ? "Click \"+ Add Company\" to create your first company."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                        Company Name <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium hidden sm:table-cell">MID</th>
                    <th className="px-3 py-3 font-medium hidden md:table-cell">Audit Level</th>
                    <th className="px-3 py-3 font-medium hidden lg:table-cell">CSM</th>
                    <th className="px-3 py-3 font-medium">Processor</th>
                    <th className="px-3 py-3 font-medium hidden md:table-cell">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("riskLevel")}>
                        Risk <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium hidden lg:table-cell">
                      <button className="flex items-center gap-1" onClick={() => toggleSort("adjustedEffectiveRate")}>
                        Eff. Rate <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.companyId}
                      className="border-b last:border-b-0 hover:bg-secondary/10 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium">{c.name}</td>
                      <td className="px-3 py-3 hidden sm:table-cell font-mono text-xs">{c.mid || "—"}</td>
                      <td className="px-3 py-3 hidden md:table-cell">{c.auditLevel || "—"}</td>
                      <td className="px-3 py-3 hidden lg:table-cell">{c.csm || "—"}</td>
                      <td className="px-3 py-3">{c.processor || "—"}</td>
                      <td className="px-3 py-3 hidden md:table-cell">{riskBadge(c.riskLevel)}</td>
                      <td className="px-3 py-3 hidden lg:table-cell font-mono text-xs">
                        {c.adjustedEffectiveRate ? `${c.adjustedEffectiveRate}%` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryCompany(c)} title="Audit history">
                            <History className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update company details and contracted rates."
                : "Enter company details and contracted service-charge rates."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Section: Company Info */}
            <div>
              <p className="text-sm font-semibold mb-3">Company Info</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="ABC NURSERY" />
                </div>
                <div className="space-y-1.5">
                  <Label>MID</Label>
                  <Input value={form.mid} onChange={(e) => setField("mid", e.target.value)} placeholder="0880" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Audit Level</Label>
                  <Select value={form.auditLevel} onValueChange={(v) => setField("auditLevel", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Level II">Level II</SelectItem>
                      <SelectItem value="Level III">Level III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Auditor</Label>
                  <Input value={form.auditor} onChange={(e) => setField("auditor", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <Select value={form.paymentMethod || "_none"} onValueChange={(v) => setField("paymentMethod", v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      <SelectItem value="CC">CC</SelectItem>
                      <SelectItem value="CHECK">CHECK</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Contacts */}
            <div>
              <p className="text-sm font-semibold mb-3">Contacts</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>CSM</Label>
                  <Input value={form.csm} onChange={(e) => setField("csm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CSM Phone</Label>
                  <Input value={form.csmPhone} onChange={(e) => setField("csmPhone", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Send To</Label>
                  <Input value={form.sendTo} onChange={(e) => setField("sendTo", e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Service Charges */}
            <div>
              <p className="text-sm font-semibold mb-3">Contracted Service Charges</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ["discountRate", "Discount"],
                  ["transactionFee", "Transaction Fee ($)"],
                  ["amexFee", "Amex Fee ($)"],
                  ["statementFee", "Statement Fee ($)"],
                  ["avsFee", "AVS Fee ($)"],
                  ["regFee", "Reg Fee ($)"],
                  ["chargebackFee", "Chargeback Fee ($)"],
                  ["authFee", "Auth Fee ($)"],
                  ["annualFee", "Annual Fee ($)"],
                  ["monitoringFee", "Monitoring Fee ($)"],
                  ["pciFee", "PCI Fee ($)"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      type="text"
                      className="font-mono"
                      value={form[key]}
                      onChange={(e) => setField(key, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Section: Gateway */}
            <div>
              <p className="text-sm font-semibold mb-3">Gateway</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gateway</Label>
                  <Input value={form.gateway} onChange={(e) => setField("gateway", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gateway Fee ($)</Label>
                  <Input
                    type="text"
                    className="font-mono"
                    value={form.gatewayFee}
                    onChange={(e) => setField("gatewayFee", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gateway Trans Fee ($)</Label>
                  <Input
                    type="text"
                    className="font-mono"
                    value={form.gatewayTransFee}
                    onChange={(e) => setField("gatewayTransFee", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Processing */}
            <div>
              <p className="text-sm font-semibold mb-3">Processing</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Processor</Label>
                  <Input value={form.processor} onChange={(e) => setField("processor", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Statement Obtain Method</Label>
                  <Select value={form.statementObtainMethod || "_none"} onValueChange={(v) => setField("statementObtainMethod", v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      <SelectItem value="Auto Pull">Auto Pull</SelectItem>
                      <SelectItem value="Email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input value={form.password} onChange={(e) => setField("password", e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Section: Risk & Rates */}
            <div>
              <p className="text-sm font-semibold mb-3">Risk & Rates</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Validation Status</Label>
                  <Input value={form.validationStatus} onChange={(e) => setField("validationStatus", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Risk Level</Label>
                  <Select value={form.riskLevel || "_none"} onValueChange={(v) => setField("riskLevel", v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      <SelectItem value="Green- Full Trust">Green- Full Trust</SelectItem>
                      <SelectItem value="Yellow-Some Caution">Yellow-Some Caution</SelectItem>
                      <SelectItem value="Red- High Risk">Red- High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Adjusted Effective Rate (%)</Label>
                  <Input
                    type="text"
                    className="font-mono"
                    value={form.adjustedEffectiveRate}
                    onChange={(e) => setField("adjustedEffectiveRate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Actual Old Effective Rate (%)</Label>
                  <Input
                    type="text"
                    className="font-mono"
                    value={form.actualOldEffectiveRate}
                    onChange={(e) => setField("actualOldEffectiveRate", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5 flex items-center gap-3 pt-6 sm:col-span-2">
                  <input
                    id="tax-exempt"
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={!!form.taxExempt}
                    onChange={(e) => setField("taxExempt", e.target.checked)}
                  />
                  <Label htmlFor="tax-exempt" className="cursor-pointer">
                    Tax Exempt — suppress downgrade findings whose rule is conditional on tax-exempt status
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Spinner className="w-4 h-4 mr-2" />}
              {editingCompany ? "Save Changes" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Audit History Dialog ── */}
      <Dialog open={!!historyCompany} onOpenChange={(open) => !open && setHistoryCompany(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit History</DialogTitle>
            <DialogDescription>
              {historyCompany?.name}{historyCompany?.mid ? ` (MID: ${historyCompany.mid})` : ""}
            </DialogDescription>
          </DialogHeader>

          {companyAudits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold mt-3">No audits found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {historyCompany?.mid
                  ? "No audits have been run with this MID yet."
                  : "Add a MID to this company to track audit history."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {companyAudits.map((a) => {
                const statusColor =
                  a.status === "complete"
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                    : a.status === "needs_review"
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                      : "bg-muted text-muted-foreground border-border";
                const fmtDate = new Date(a.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const fmtMoney = (n?: number) =>
                  typeof n === "number"
                    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—";

                return (
                  <div
                    key={a.auditId}
                    className="rounded-lg border border-border p-3 hover:bg-secondary/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{a.statementPeriod || a.statementMonth || fmtDate}</p>
                          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                            {a.status === "complete" ? "Complete" : a.status === "needs_review" ? "Needs Review" : a.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span>Vol: {fmtMoney(a.totalVolume)}</span>
                          <span>Fees: {fmtMoney(a.totalFees)}</span>
                          {a.effectiveRate != null && (
                            <span>OER: {(a.effectiveRate * 100).toFixed(2)}%</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {a.processorDetected || a.processor || "—"} &middot; {fmtDate}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                          window.location.href = `/report?auditId=${a.auditId}`;
                        }}
                        title="View report"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Spinner className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
