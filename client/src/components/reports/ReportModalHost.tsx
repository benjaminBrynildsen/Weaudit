import { useEffect, useState } from "react";
import AuditReportModal from "./AuditReportModal";
import { onOpenAuditReport } from "./auditReportEvents";
import type { AuditReportData } from "./AuditReportDocument";

export default function ReportModalHost() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AuditReportData | null>(null);

  useEffect(() => {
    return onOpenAuditReport((d) => {
      setData(d);
      setOpen(true);
    });
  }, []);

  if (!data) return null;
  return <AuditReportModal open={open} onOpenChange={setOpen} data={data} />;
}