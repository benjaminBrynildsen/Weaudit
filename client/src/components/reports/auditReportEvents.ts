import type { AuditReportData } from "./AuditReportDocument";

type OpenEventDetail = {
  data: AuditReportData;
};

const EVENT_NAME = "autoaudit:open-report";

export function openAuditReport(data: AuditReportData) {
  window.dispatchEvent(new CustomEvent<OpenEventDetail>(EVENT_NAME, { detail: { data } }));
}

export function onOpenAuditReport(handler: (data: AuditReportData) => void) {
  const listener = (e: Event) => {
    const ce = e as CustomEvent<OpenEventDetail>;
    if (!ce.detail?.data) return;
    handler(ce.detail.data);
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}