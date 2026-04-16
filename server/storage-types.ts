// Shared domain types + storage interface. Kept separate from storage.ts
// so both the DynamoDB and Postgres backends can implement IStorage without
// import cycles via the Drizzle schema.

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

export interface Statement {
  statementId: string;
  auditId: string;
  fileName: string;
  filePath: string;
  fileType: "pdf" | "csv";
  rawText?: string;
  uploadedAt: string;
}

export type FindingType = "non_pci" | "downgrade" | "padding" | "unknown";
export type FindingStatus = "open" | "acknowledged" | "resolved" | "false_positive";

export interface Finding {
  findingId: string;
  auditId: string;
  type: FindingType;
  title: string;
  category: string;
  rawLine: string;
  amount: number;
  rate: number;
  page: number;
  lineNum: number;
  severity: "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  status: FindingStatus;
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
  informational?: boolean;
}

export interface ProcessorISO {
  isoId: string;
  name: string;
  aliases: string[];
  enabled: boolean;
}

export type UnknownFeeApproval = "pending" | "approved" | "escalated";

export interface UnknownFee {
  unknownFeeId: string;
  findingId: string;
  auditId: string;
  rawLine: string;
  amount: number;
  approvalStatus: UnknownFeeApproval;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Notice {
  noticeId: string;
  auditId: string;
  type: string;
  amount: number;
  message: string;
  createdAt: string;
}

export interface User {
  userId: string;
  googleSub: string;
  email: string;
  name: string;
  picture?: string;
  hd?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface Company {
  companyId: string;
  name: string;
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

export interface IStorage {
  // Audits
  createAudit(data: Omit<Audit, "auditId" | "createdAt">): Promise<Audit>;
  getAudit(auditId: string): Promise<Audit | undefined>;
  listAudits(): Promise<Audit[]>;
  updateAudit(auditId: string, patch: Partial<Audit>): Promise<Audit | undefined>;

  // Statements
  createStatement(data: Omit<Statement, "statementId" | "uploadedAt">): Promise<Statement>;
  getStatement(statementId: string): Promise<Statement | undefined>;
  getStatementsByAudit(auditId: string): Promise<Statement[]>;

  // Findings
  createFinding(data: Omit<Finding, "findingId">): Promise<Finding>;
  getFinding(findingId: string): Promise<Finding | undefined>;
  getFindingsByAudit(auditId: string): Promise<Finding[]>;
  updateFinding(findingId: string, patch: Partial<Finding>): Promise<Finding | undefined>;
  deleteFindingsByAudit(auditId: string): Promise<void>;

  // Unknown fees (delete by audit)
  deleteUnknownFeesByAudit(auditId: string): Promise<void>;

  // Downgrade rules
  listDowngradeRules(): Promise<DowngradeRule[]>;
  getDowngradeRule(ruleId: string): Promise<DowngradeRule | undefined>;
  createDowngradeRule(data: Omit<DowngradeRule, "ruleId">): Promise<DowngradeRule>;
  updateDowngradeRule(ruleId: string, patch: Partial<DowngradeRule>): Promise<DowngradeRule | undefined>;
  deleteDowngradeRule(ruleId: string): Promise<void>;

  // Processor ISOs
  listProcessorISOs(): Promise<ProcessorISO[]>;
  getProcessorISO(isoId: string): Promise<ProcessorISO | undefined>;
  createProcessorISO(data: Omit<ProcessorISO, "isoId">): Promise<ProcessorISO>;
  updateProcessorISO(isoId: string, patch: Partial<ProcessorISO>): Promise<ProcessorISO | undefined>;
  deleteProcessorISO(isoId: string): Promise<void>;

  // Unknown fees
  getUnknownFee(unknownFeeId: string): Promise<UnknownFee | undefined>;
  getUnknownFeesByAudit(auditId: string): Promise<UnknownFee[]>;
  createUnknownFee(data: Omit<UnknownFee, "unknownFeeId">): Promise<UnknownFee>;
  updateUnknownFee(unknownFeeId: string, patch: Partial<UnknownFee>): Promise<UnknownFee | undefined>;

  // Notices
  createNotice(data: Omit<Notice, "noticeId" | "createdAt">): Promise<Notice>;
  getNoticesByAudit(auditId: string): Promise<Notice[]>;

  // Users (authentication)
  getUserByGoogleSub(googleSub: string): Promise<User | undefined>;
  getUserById(userId: string): Promise<User | undefined>;
  upsertUserByGoogleSub(
    data: Omit<User, "userId" | "createdAt" | "lastLoginAt">,
  ): Promise<User>;

  // Companies
  listCompanies(): Promise<Company[]>;
  getCompany(companyId: string): Promise<Company | undefined>;
  createCompany(data: Omit<Company, "companyId" | "createdAt" | "updatedAt">): Promise<Company>;
  updateCompany(companyId: string, patch: Partial<Company>): Promise<Company | undefined>;
  deleteCompany(companyId: string): Promise<void>;
}
