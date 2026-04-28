import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

// ── Types (mirror server types) ──────────────────────────────────────────────

export type AuditStatus = "idle" | "scanning" | "needs_review" | "complete" | "failed";

export interface Audit {
  auditId: string;
  clientName: string;
  processor: string;
  statementMonth: string;
  mid: string;
  status: AuditStatus;
  createdAt: string;
  completedAt?: string;
  totalVolume?: number;
  totalFees?: number;
  amexVolume?: number;
  amexFees?: number;
  effectiveRate?: number;
  dba?: string;
  statementPeriod?: string;
  processorDetected?: string;
  gatewayLevel?: "II" | "III";
  errorMessage?: string;
}

export interface Finding {
  findingId: string;
  auditId: string;
  type: "non_pci" | "downgrade" | "padding" | "unknown" | "service_charge";
  title: string;
  category: string;
  rawLine: string;
  amount: number;
  rate: number;
  page: number;
  lineNum: number;
  severity: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  status: "open" | "acknowledged" | "resolved" | "false_positive";
  reason: string;
  recommendedAction: string;
  targetRate?: number;
  spread?: number;
  priority?: number;
  needsReview?: boolean;
}

export interface DowngradeRule {
  ruleId: string;
  brand: "V" | "M";
  name: string;
  rate: number;
  reason: string;
  targetRate: number;
  levelTags: string[];
  keywords: string[];
  enabled: boolean;
  createdAt?: string;
  lastMatchedAt?: string;
}

export interface ProcessorISO {
  isoId: string;
  name: string;
  aliases: string[];
  enabled: boolean;
}

export interface Notice {
  noticeId: string;
  auditId: string;
  type: string;
  amount: number;
  message: string;
  createdAt: string;
}

export interface Company {
  companyId: string;
  name: string;
  mid: string;
  dba: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
  auditLevel: string;
  auditor: string;
  paymentMethod: string;
  csm: string;
  csmPhone: string;
  sendTo: string;
  discountRate: number;
  transactionFee: number;
  amexFee: number;
  statementFee: number;
  avsFee: number;
  regFee: number;
  chargebackFee: number;
  authFee: number;
  annualFee: number;
  monitoringFee: number;
  pciFee: number;
  gateway: string;
  gatewayFee: number;
  gatewayTransFee: number;
  processor: string;
  statementObtainMethod: string;
  password: string;
  validationStatus: string;
  riskLevel: string;
  adjustedEffectiveRate: number;
  actualOldEffectiveRate: number;
  taxExempt: boolean;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAudits() {
  return useQuery<Audit[]>({ queryKey: ["/api/audits"] });
}

export function useAudit(auditId: string | undefined) {
  return useQuery<
    Audit & {
      findings: Finding[];
      statements: any[];
      notices: Notice[];
      companyMatch?: { matched: boolean; companyId?: string; companyName?: string };
    }
  >({
    queryKey: ["/api/audits", auditId],
    enabled: !!auditId,
  });
}

export function useAuditStatus(auditId: string | undefined, polling = false) {
  return useQuery<{ auditId: string; status: AuditStatus; errorMessage?: string }>({
    queryKey: ["/api/audits", auditId, "status"],
    enabled: !!auditId && polling,
    refetchInterval: polling ? 1000 : false,
  });
}

export function useFindings(auditId: string | undefined) {
  return useQuery<Finding[]>({
    queryKey: ["/api/findings?auditId=" + auditId],
    enabled: !!auditId,
  });
}

export function useDowngradeRules() {
  return useQuery<DowngradeRule[]>({ queryKey: ["/api/downgrade-rules"] });
}

export function useProcessorISOs() {
  return useQuery<ProcessorISO[]>({ queryKey: ["/api/processor-isos"] });
}

export function useReport(auditId: string | undefined) {
  return useQuery({
    queryKey: ["/api/reports", auditId],
    enabled: !!auditId,
    staleTime: 0, // Always refetch so report reflects latest scan data
  });
}

export function useNotices(auditId: string | undefined) {
  return useQuery<Notice[]>({
    queryKey: ["/api/notices?auditId=" + auditId],
    enabled: !!auditId,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useUploadStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/findings"] });
    },
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Audit>) => {
      const res = await apiRequest("POST", "/api/audits", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
    },
  });
}

export function useUpdateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ auditId, ...data }: Partial<Audit> & { auditId: string }) => {
      const res = await apiRequest("PATCH", `/api/audits/${auditId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
    },
  });
}

export function useTriggerScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (auditId: string) => {
      const res = await apiRequest("POST", `/api/audits/${auditId}/scan`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/findings"] });
    },
  });
}

export function useUpdateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ findingId, ...data }: Partial<Finding> & { findingId: string }) => {
      const res = await apiRequest("PATCH", `/api/findings/${findingId}`, data);
      return res.json();
    },
    onSuccess: () => {
      // useFindings stores its cache under "/api/findings?auditId=…" (per-audit
      // URL key), so a literal "/api/findings" invalidate never matches. Use a
      // predicate to catch every findings query regardless of its querystring.
      qc.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/findings"),
      });
      qc.invalidateQueries({ queryKey: ["/api/audits"] });
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
    },
  });
}

// ── Downgrade Rule mutations ──

export function useCreateDowngradeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<DowngradeRule, "ruleId">) => {
      const res = await apiRequest("POST", "/api/downgrade-rules", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/downgrade-rules"] });
    },
  });
}

export function useUpdateDowngradeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, ...data }: Partial<DowngradeRule> & { ruleId: string }) => {
      const res = await apiRequest("PATCH", `/api/downgrade-rules/${ruleId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/downgrade-rules"] });
    },
  });
}

export function useDeleteDowngradeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const res = await apiRequest("DELETE", `/api/downgrade-rules/${ruleId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/downgrade-rules"] });
    },
  });
}

// ── Processor ISO mutations ──

export function useCreateProcessorISO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ProcessorISO, "isoId">) => {
      const res = await apiRequest("POST", "/api/processor-isos", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/processor-isos"] });
    },
  });
}

export function useUpdateProcessorISO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ isoId, ...data }: Partial<ProcessorISO> & { isoId: string }) => {
      const res = await apiRequest("PATCH", `/api/processor-isos/${isoId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/processor-isos"] });
    },
  });
}

export function useDeleteProcessorISO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (isoId: string) => {
      const res = await apiRequest("DELETE", `/api/processor-isos/${isoId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/processor-isos"] });
    },
  });
}

// ── Notice mutations ──

export function useCreateNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { auditId: string; type: string; amount: number; message: string }) => {
      const res = await apiRequest("POST", "/api/notices", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notices"] });
    },
  });
}

// ── Company hooks ──

export function useCompanies() {
  return useQuery<Company[]>({ queryKey: ["/api/companies"] });
}

export function useCompany(companyId: string | undefined) {
  return useQuery<Company>({
    queryKey: ["/api/companies", companyId],
    enabled: !!companyId,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<Company, "companyId" | "createdAt" | "updatedAt">) => {
      const res = await apiRequest("POST", "/api/companies", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, ...data }: Partial<Company> & { companyId: string }) => {
      const res = await apiRequest("PATCH", `/api/companies/${companyId}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const res = await apiRequest("DELETE", `/api/companies/${companyId}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}

// ── Unknown fee mutations ──

export function useUpdateUnknownFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ unknownFeeId, ...data }: { unknownFeeId: string; approvalStatus: string; reviewedBy?: string }) => {
      const res = await apiRequest("PATCH", `/api/unknown-fees/${unknownFeeId}`, {
        ...data,
        reviewedAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/findings"] });
    },
  });
}
