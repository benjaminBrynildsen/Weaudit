import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowLeft, Loader2, AlertTriangle, Minimize2 } from "lucide-react";
import { usePDF, pdf } from "@react-pdf/renderer";
import AuditReportDocument from "@/components/reports/AuditReportDocument";
import type { AuditReportData } from "@/components/reports/AuditReportDocument";
import { makeMockAuditReport } from "@/lib/mockAuditReport";
import { useReport } from "@/lib/api";

/**
 * Convert a "YYYY-MM" statement month to "Month Year" (e.g. "2025-12" →
 * "December 2025"). Free-form values pass through unchanged so we never
 * mangle a month the user typed in their own format.
 */
function formatStatementMonthLong(month: string): string {
  const m = /^(\d{4})-(\d{1,2})$/.exec(month.trim());
  if (!m) return month.trim();
  const [, year, monthNum] = m;
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

/**
 * Build the downloaded-PDF filename using Amanda's existing convention so
 * generated reports drop into her workflow without renaming. Pattern:
 *   "<Merchant>[ <MID-tail>] <Month> <Year> Audit.pdf"
 * The MID-tail is appended only when not already present in the merchant
 * string (Companies-roster names sometimes already include it).
 */
function buildAuditPdfFileName(merchant: string, statementMonth: string, mid: string): string {
  const cleanedMerchant = (merchant || "").trim() || "Audit";
  const tail = (mid || "").replace(/\D/g, "").slice(-4);
  const tailPart = tail && !cleanedMerchant.includes(tail) ? ` ${tail}` : "";
  const monthPart = formatStatementMonthLong(statementMonth);
  const monthSegment = monthPart ? ` ${monthPart}` : "";
  const raw = `${cleanedMerchant}${tailPart}${monthSegment} Audit.pdf`;
  // Strip filesystem-hostile characters and collapse whitespace.
  return raw.replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

/** Custom PDF preview that shows loading/error states instead of a blank iframe. */
function PDFPreview({
  document,
  heightClass = "h-[72vh]",
}: {
  document: React.ReactElement;
  heightClass?: string;
}) {
  const [instance, updateInstance] = usePDF({ document: document as any });

  useEffect(() => {
    updateInstance(document as any);
  }, [document, updateInstance]);

  return (
    <div className={`${heightClass} overflow-hidden rounded-lg border border-border bg-secondary/20 relative`}>
      {instance.loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-secondary/20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Generating PDF...</p>
        </div>
      )}
      {instance.error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-secondary/20 px-6">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-destructive font-medium">PDF rendering failed</p>
          <p className="text-xs text-muted-foreground text-center max-w-md">
            {String(instance.error) || "Unknown error"}
          </p>
        </div>
      )}
      {instance.url && (
        <iframe
          src={`${instance.url}#toolbar=0`}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Audit report PDF preview"
        />
      )}
    </div>
  );
}

export default function Report() {
  const [, setLocation] = useLocation();
  const [downloading, setDownloading] = useState(false);

  // Read URL query params:
  //   ?auditId=xxx          — which audit to load
  //   ?fullscreen=1         — render the report as a full-viewport workspace
  //                           (no DashboardLayout chrome) for in-flow generation
  //   ?from=bulk            — back button returns to the bulk queue
  const { auditId, isFullScreen, fromBulk } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      auditId: params.get("auditId") ?? undefined,
      isFullScreen: params.get("fullscreen") === "1",
      fromBulk: params.get("from") === "bulk",
    };
  }, []);

  // Fetch real report data from /api/reports/:auditId when available
  const { data: apiData, isLoading } = useReport(auditId);

  // Fall back to mock data when no auditId or API hasn't returned data yet
  const mockData = useMemo(() => makeMockAuditReport(), []);
  const data: AuditReportData = (apiData as AuditReportData) ?? mockData;

  const [draft, setDraft] = useState(() => ({
    merchant: data.merchant,
    location: data.location,
    statementMonth: data.statementMonth,
    processor: data.processor,
    mid: data.mid,
    volume: data.volume,
    status: data.status,
    discountSavings: data.summary.discountSavings,
    revenueLost: data.summary.revenueLost,
  }));

  // Sync draft when API data arrives (replaces mock defaults with real values)
  useEffect(() => {
    if (!apiData) return;
    const d = apiData as AuditReportData;
    setDraft({
      merchant: d.merchant,
      location: d.location,
      statementMonth: d.statementMonth,
      processor: d.processor,
      mid: d.mid,
      volume: d.volume,
      status: d.status,
      discountSavings: d.summary.discountSavings,
      revenueLost: d.summary.revenueLost,
    });
  }, [apiData]);

  // Build the PDF document data directly from the API response (or fallback mock).
  // Previously this used makeMockAuditReport which replaced real findings with fake ones.
  const doc = useMemo(
    () => (
      <AuditReportDocument
        data={{
          auditId: data.auditId,
          merchant: draft.merchant,
          location: draft.location,
          statementMonth: draft.statementMonth,
          processor: draft.processor,
          mid: draft.mid,
          volume: draft.volume,
          status: draft.status,
          summary: {
            discountSavings: draft.discountSavings,
            revenueLost: draft.revenueLost,
          },
          flags: data.flags,
          findings: data.findings,
          gatewayLevel: (data as AuditReportData & { gatewayLevel?: "II" | "III" }).gatewayLevel,
          notes: data.notes,
        }}
      />
    ),
    [data, draft],
  );

  // Match Amanda's naming convention from /Test Files/.../Amanda_s Audits/ so
  // the downloaded files drop into the same workflow seamlessly. Examples:
  //   "Patriot Flooring 0880 December 2025 Audit.pdf"
  //   "Mars Electric MACEDONIA February 2026 Audit.pdf"
  //   "SeoTuners February 2026 Audit.pdf"
  const fileName = buildAuditPdfFileName(draft.merchant, draft.statementMonth, draft.mid);

  const download = async () => {
    try {
      setDownloading(true);
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.setAttribute("data-testid", "link-download-report");
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // ESC exits fullscreen mode. Mirrors the audit workspace UX so muscle
  // memory carries over between the two surfaces.
  const exitFullScreen = () => {
    if (fromBulk) {
      window.location.href = "/bulk-audit";
    } else {
      const next = new URL(window.location.href);
      next.searchParams.delete("fullscreen");
      next.searchParams.delete("from");
      window.location.href = next.pathname + (next.search ? next.search : "");
    }
  };
  useEffect(() => {
    if (!isFullScreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFullScreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreen, fromBulk]);

  const editFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label data-testid="label-report-merchant" className="text-[11px] text-muted-foreground">
            Merchant
          </label>
          <input
            data-testid="input-report-merchant"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={draft.merchant}
            onChange={(e) => setDraft((p) => ({ ...p, merchant: e.target.value }))}
          />
        </div>
        <div>
          <label data-testid="label-report-location" className="text-[11px] text-muted-foreground">
            Location
          </label>
          <input
            data-testid="input-report-location"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={draft.location}
            onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label data-testid="label-report-statement-month" className="text-[11px] text-muted-foreground">
            Statement month
          </label>
          <input
            data-testid="input-report-statement-month"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
            value={draft.statementMonth}
            onChange={(e) => setDraft((p) => ({ ...p, statementMonth: e.target.value }))}
            placeholder="YYYY-MM"
          />
        </div>
        <div>
          <label data-testid="label-report-processor" className="text-[11px] text-muted-foreground">
            Processor
          </label>
          <input
            data-testid="input-report-processor"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={draft.processor}
            onChange={(e) => setDraft((p) => ({ ...p, processor: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label data-testid="label-report-mid" className="text-[11px] text-muted-foreground">
            MID
          </label>
          <input
            data-testid="input-report-mid"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
            value={draft.mid}
            onChange={(e) => setDraft((p) => ({ ...p, mid: e.target.value }))}
          />
        </div>
        <div>
          <label data-testid="label-report-volume" className="text-[11px] text-muted-foreground">
            Volume
          </label>
          <input
            data-testid="input-report-volume"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
            value={draft.volume}
            onChange={(e) => setDraft((p) => ({ ...p, volume: e.target.value }))}
            placeholder="$0.00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label data-testid="label-report-discount-savings" className="text-[11px] text-muted-foreground">
            Discount savings (est.)
          </label>
          <input
            data-testid="input-report-discount-savings"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
            value={draft.discountSavings}
            onChange={(e) => setDraft((p) => ({ ...p, discountSavings: e.target.value }))}
            placeholder="$0.00"
          />
        </div>
        <div>
          <label data-testid="label-report-revenue-lost" className="text-[11px] text-muted-foreground">
            Revenue lost (est.)
          </label>
          <input
            data-testid="input-report-revenue-lost"
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-mono"
            value={draft.revenueLost}
            onChange={(e) => setDraft((p) => ({ ...p, revenueLost: e.target.value }))}
            placeholder="$0.00"
          />
        </div>
      </div>

      <div>
        <label data-testid="label-report-status" className="text-[11px] text-muted-foreground">
          Status
        </label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(["Needs Review", "In Progress", "Complete"] as const).map((s) => (
            <button
              key={s}
              data-testid={`button-report-status-${s.replace(/\s+/g, "-").toLowerCase()}`}
              className={`h-9 px-3 rounded-md border text-sm transition-colors ${
                draft.status === s
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border hover:bg-secondary/50"
              }`}
              onClick={() => setDraft((p) => ({ ...p, status: s }))}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Fullscreen workspace: mirrors the dashboard audit workspace pattern —
  // top bar, edit panel left, PDF preview right, full viewport.
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        {/* Top bar */}
        <div className="h-14 shrink-0 flex items-center justify-between gap-4 border-b border-border bg-card px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              data-testid="button-report-back"
              variant="ghost"
              size="sm"
              onClick={exitFullScreen}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {fromBulk ? "Back to bulk" : "Exit"}
            </Button>
            <div className="hidden md:block w-px h-5 bg-border" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{draft.merchant}</p>
              <p className="text-xs text-muted-foreground truncate">
                {draft.statementMonth}
                {draft.mid ? ` · MID ${draft.mid}` : ""}
                {draft.processor ? ` · ${draft.processor}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-muted-foreground hidden sm:inline-flex">
              {draft.status}
            </Badge>
            <Button
              data-testid="button-report-download"
              onClick={download}
              disabled={downloading}
              className="shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloading ? "Preparing…" : "Generate official report"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={exitFullScreen}
              title="Exit full screen (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Two-pane workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-5 border-r border-border overflow-y-auto p-5">
            <p className="text-sm font-semibold">Edit report fields</p>
            <p className="text-xs text-muted-foreground mt-1">
              These values drive the PDF preview in real time.
            </p>
            <div className="mt-4">{editFields}</div>
          </div>
          <div className="md:col-span-7 p-3 bg-secondary/20 min-h-0">
            <PDFPreview document={doc} heightClass="h-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                data-testid="button-report-back"
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => setLocation(fromBulk ? "/bulk-audit" : "/history")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </div>
            <h1 data-testid="text-report-page-title" className="text-3xl font-bold font-heading tracking-tight">
              Audit report
            </h1>
            <p data-testid="text-report-page-subtitle" className="text-muted-foreground mt-1">
              Edit fields on the left and see the PDF update instantly.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge data-testid="badge-report-page-status" variant="outline" className="text-xs text-muted-foreground">
              {draft.status}
            </Badge>
            <Button
              data-testid="button-report-download"
              onClick={download}
              disabled={downloading}
              className="shadow-lg shadow-primary/15"
            >
              <Download className="w-4 h-4 mr-2" /> {downloading ? "Preparing…" : "Download"}
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <p data-testid="text-report-editor-title" className="text-sm font-semibold">
                Edit report fields
              </p>
              <p data-testid="text-report-editor-subtitle" className="text-xs text-muted-foreground mt-1">
                These values drive the PDF preview in real time.
              </p>

              <div className="mt-4">{editFields}</div>
            </div>

            <div className="md:col-span-7">
              <PDFPreview document={doc} />
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
