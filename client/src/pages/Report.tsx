import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import AuditReportDocument from "@/components/reports/AuditReportDocument";
import { makeMockAuditReport } from "@/lib/mockAuditReport";

export default function Report() {
  const [, setLocation] = useLocation();
  const [downloading, setDownloading] = useState(false);

  const data = useMemo(() => makeMockAuditReport(), []);
  const doc = useMemo(() => <AuditReportDocument data={data} />, [data]);

  const fileName = `${data.merchant.replace(/\s+/g, "-")}-${data.statementMonth}-${data.auditId}.pdf`.toLowerCase();

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

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                data-testid="button-report-back"
                variant="ghost"
                size="sm"
                className="-ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => setLocation("/history")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </div>
            <h1 data-testid="text-report-page-title" className="text-3xl font-bold font-heading tracking-tight">
              Audit report
            </h1>
            <p data-testid="text-report-page-subtitle" className="text-muted-foreground mt-1">
              Preview the PDF in-app, then download.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge data-testid="badge-report-page-status" variant="outline" className="text-xs text-muted-foreground">
              {data.status}
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <p data-testid="text-report-meta" className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-foreground">{data.merchant}</span>
                </span>
                <span className="mx-2">•</span>
                <span className="font-mono">{data.statementMonth}</span>
                <span className="mx-2">•</span>
                <span className="font-mono">{data.auditId}</span>
              </p>
            </div>
            <div className="text-xs text-muted-foreground">Download attaches in full app (mock)</div>
          </div>
          <Separator className="my-4" />
          <div className="h-[72vh] overflow-hidden rounded-lg border border-border bg-secondary/20">
            <PDFViewer style={{ width: "100%", height: "100%" }} showToolbar={false}>
              {doc}
            </PDFViewer>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}