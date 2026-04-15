import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Loader2, AlertTriangle } from "lucide-react";
import { usePDF, pdf } from "@react-pdf/renderer";
import AuditReportDocument, { type AuditReportData } from "./AuditReportDocument";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AuditReportData;
};

function ModalPDFPreview({ document }: { document: React.ReactElement }) {
  const [instance, updateInstance] = usePDF({ document: document as any });

  useEffect(() => {
    updateInstance(document as any);
  }, [document, updateInstance]);

  if (instance.loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating PDF...</p>
      </div>
    );
  }

  if (instance.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive font-medium">PDF rendering failed</p>
        <p className="text-xs text-muted-foreground text-center max-w-md">
          {String(instance.error) || "Unknown error"}
        </p>
      </div>
    );
  }

  if (!instance.url) return null;

  return (
    <iframe
      src={`${instance.url}#toolbar=0`}
      style={{ width: "100%", height: "100%", border: "none" }}
      title="Audit report PDF preview"
    />
  );
}

export default function AuditReportModal({ open, onOpenChange, data }: Props) {
  const document = useMemo(() => <AuditReportDocument data={data} />, [data]);

  // Match the manual audit filename format used in Test Files/:
  //   "{Client Name} {MID last 4} {Month} {Year} Audit.pdf"
  // MID segment is omitted when the merchant doesn't have a MID on file.
  const fileName = (() => {
    const merchant = data.merchant.replace(/[\\/]+/g, " ").trim();
    const midDigits = (data.mid || "").replace(/\D/g, "");
    const midSegment = midDigits.length >= 4 ? ` ${midDigits.slice(-4)}` : "";
    const month = data.statementMonth.trim();
    return `${merchant}${midSegment} ${month} Audit.pdf`.replace(/\s+/g, " ");
  })();

  const download = async () => {
    const blob = await pdf(document).toBlob();
    const url = URL.createObjectURL(blob);

    const a = window.document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.setAttribute("data-testid", "link-download-report");
    window.document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[980px] p-0 overflow-hidden">
        <div className="border-b border-border bg-background/80 backdrop-blur px-5 py-4">
          <DialogHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle data-testid="text-report-modal-title" className="font-heading text-xl">
                  Audit report
                </DialogTitle>
                <DialogDescription data-testid="text-report-modal-subtitle">
                  Preview the PDF, then download and attach it to the audit.
                </DialogDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge data-testid="badge-report-status" variant="outline" className="text-xs text-muted-foreground">
                  {data.status}
                </Badge>
                <Button data-testid="button-download-report" onClick={download} className="shadow-lg shadow-primary/15">
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span data-testid="text-report-meta-merchant" className="inline-flex items-center gap-2">
                <FileText className="w-4 h-4" /> {data.merchant}
              </span>
              <span data-testid="text-report-meta-month" className="font-mono">{data.statementMonth}</span>
              <span data-testid="text-report-meta-audit" className="font-mono">{data.auditId}</span>
            </div>
          </DialogHeader>
        </div>

        <div className="h-[72vh] bg-secondary/20">
          <ModalPDFPreview document={document} />
        </div>
      </DialogContent>
    </Dialog>
  );
}