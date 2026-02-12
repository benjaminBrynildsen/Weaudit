import { randomUUID } from "crypto";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ddb,
  TABLE_AUDITS,
  TABLE_STATEMENTS,
  TABLE_FINDINGS,
  TABLE_DOWNGRADE_RULES,
  TABLE_PROCESSOR_ISOS,
  TABLE_UNKNOWN_FEES,
  TABLE_NOTICES,
} from "./db/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditStatus = "idle" | "scanning" | "needs_review" | "complete";

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
  informational?: boolean; // If true, exclude from primary audit (show as informational/optional recovery)
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

// ── Interface ────────────────────────────────────────────────────────────────

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

  // Unknown fees
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
}

// ── DynamoDB Implementation ──────────────────────────────────────────────────

export class DynamoStorage implements IStorage {
  // ── Audits ──

  async createAudit(data: Omit<Audit, "auditId" | "createdAt">): Promise<Audit> {
    const audit: Audit = {
      ...data,
      auditId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: TABLE_AUDITS, Item: audit }));
    return audit;
  }

  async getAudit(auditId: string): Promise<Audit | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_AUDITS, Key: { auditId } }));
    return res.Item as Audit | undefined;
  }

  async listAudits(): Promise<Audit[]> {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE_AUDITS }));
    const items = (res.Items || []) as Audit[];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateAudit(auditId: string, patch: Partial<Audit>): Promise<Audit | undefined> {
    const existing = await this.getAudit(auditId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, auditId };
    await ddb.send(new PutCommand({ TableName: TABLE_AUDITS, Item: merged }));
    return merged;
  }

  // ── Statements ──

  async createStatement(data: Omit<Statement, "statementId" | "uploadedAt">): Promise<Statement> {
    const statement: Statement = {
      ...data,
      statementId: randomUUID(),
      uploadedAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: TABLE_STATEMENTS, Item: statement }));
    return statement;
  }

  async getStatement(statementId: string): Promise<Statement | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_STATEMENTS, Key: { statementId } }));
    return res.Item as Statement | undefined;
  }

  async getStatementsByAudit(auditId: string): Promise<Statement[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_STATEMENTS,
        IndexName: "auditId-index",
        KeyConditionExpression: "auditId = :aid",
        ExpressionAttributeValues: { ":aid": auditId },
      })
    );
    return (res.Items || []) as Statement[];
  }

  // ── Findings ──

  async createFinding(data: Omit<Finding, "findingId">): Promise<Finding> {
    const finding: Finding = { ...data, findingId: randomUUID() };
    await ddb.send(new PutCommand({ TableName: TABLE_FINDINGS, Item: finding }));
    return finding;
  }

  async getFinding(findingId: string): Promise<Finding | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_FINDINGS, Key: { findingId } }));
    return res.Item as Finding | undefined;
  }

  async getFindingsByAudit(auditId: string): Promise<Finding[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_FINDINGS,
        IndexName: "auditId-index",
        KeyConditionExpression: "auditId = :aid",
        ExpressionAttributeValues: { ":aid": auditId },
      })
    );
    return (res.Items || []) as Finding[];
  }

  async updateFinding(findingId: string, patch: Partial<Finding>): Promise<Finding | undefined> {
    const existing = await this.getFinding(findingId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, findingId };
    await ddb.send(new PutCommand({ TableName: TABLE_FINDINGS, Item: merged }));
    return merged;
  }

  async deleteFindingsByAudit(auditId: string): Promise<void> {
    const findings = await this.getFindingsByAudit(auditId);
    for (const f of findings) {
      await ddb.send(new DeleteCommand({ TableName: TABLE_FINDINGS, Key: { findingId: f.findingId } }));
    }
  }

  async deleteUnknownFeesByAudit(auditId: string): Promise<void> {
    const fees = await this.getUnknownFeesByAudit(auditId);
    for (const f of fees) {
      await ddb.send(new DeleteCommand({ TableName: TABLE_UNKNOWN_FEES, Key: { unknownFeeId: f.unknownFeeId } }));
    }
  }

  // ── Downgrade Rules ──

  async listDowngradeRules(): Promise<DowngradeRule[]> {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE_DOWNGRADE_RULES }));
    return (res.Items || []) as DowngradeRule[];
  }

  async getDowngradeRule(ruleId: string): Promise<DowngradeRule | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_DOWNGRADE_RULES, Key: { ruleId } }));
    return res.Item as DowngradeRule | undefined;
  }

  async createDowngradeRule(data: Omit<DowngradeRule, "ruleId">): Promise<DowngradeRule> {
    const rule: DowngradeRule = { ...data, ruleId: randomUUID() };
    await ddb.send(new PutCommand({ TableName: TABLE_DOWNGRADE_RULES, Item: rule }));
    return rule;
  }

  async updateDowngradeRule(ruleId: string, patch: Partial<DowngradeRule>): Promise<DowngradeRule | undefined> {
    const existing = await this.getDowngradeRule(ruleId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, ruleId };
    await ddb.send(new PutCommand({ TableName: TABLE_DOWNGRADE_RULES, Item: merged }));
    return merged;
  }

  async deleteDowngradeRule(ruleId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: TABLE_DOWNGRADE_RULES, Key: { ruleId } }));
  }

  // ── Processor ISOs ──

  async listProcessorISOs(): Promise<ProcessorISO[]> {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE_PROCESSOR_ISOS }));
    return (res.Items || []) as ProcessorISO[];
  }

  async getProcessorISO(isoId: string): Promise<ProcessorISO | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_PROCESSOR_ISOS, Key: { isoId } }));
    return res.Item as ProcessorISO | undefined;
  }

  async createProcessorISO(data: Omit<ProcessorISO, "isoId">): Promise<ProcessorISO> {
    const iso: ProcessorISO = { ...data, isoId: randomUUID() };
    await ddb.send(new PutCommand({ TableName: TABLE_PROCESSOR_ISOS, Item: iso }));
    return iso;
  }

  async updateProcessorISO(isoId: string, patch: Partial<ProcessorISO>): Promise<ProcessorISO | undefined> {
    const existing = await this.getProcessorISO(isoId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, isoId };
    await ddb.send(new PutCommand({ TableName: TABLE_PROCESSOR_ISOS, Item: merged }));
    return merged;
  }

  async deleteProcessorISO(isoId: string): Promise<void> {
    await ddb.send(new DeleteCommand({ TableName: TABLE_PROCESSOR_ISOS, Key: { isoId } }));
  }

  // ── Unknown Fees ──

  async getUnknownFee(unknownFeeId: string): Promise<UnknownFee | undefined> {
    const res = await ddb.send(new GetCommand({ TableName: TABLE_UNKNOWN_FEES, Key: { unknownFeeId } }));
    return res.Item as UnknownFee | undefined;
  }

  async getUnknownFeesByAudit(auditId: string): Promise<UnknownFee[]> {
    // Scan with filter since we don't have an auditId GSI on unknown fees
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLE_UNKNOWN_FEES,
        FilterExpression: "auditId = :aid",
        ExpressionAttributeValues: { ":aid": auditId },
      })
    );
    return (res.Items || []) as UnknownFee[];
  }

  async createUnknownFee(data: Omit<UnknownFee, "unknownFeeId">): Promise<UnknownFee> {
    const uf: UnknownFee = { ...data, unknownFeeId: randomUUID() };
    await ddb.send(new PutCommand({ TableName: TABLE_UNKNOWN_FEES, Item: uf }));
    return uf;
  }

  async updateUnknownFee(unknownFeeId: string, patch: Partial<UnknownFee>): Promise<UnknownFee | undefined> {
    const existing = await this.getUnknownFee(unknownFeeId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, unknownFeeId };
    await ddb.send(new PutCommand({ TableName: TABLE_UNKNOWN_FEES, Item: merged }));
    return merged;
  }

  // ── Notices ──

  async createNotice(data: Omit<Notice, "noticeId" | "createdAt">): Promise<Notice> {
    const notice: Notice = {
      ...data,
      noticeId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: TABLE_NOTICES, Item: notice }));
    return notice;
  }

  async getNoticesByAudit(auditId: string): Promise<Notice[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NOTICES,
        IndexName: "auditId-index",
        KeyConditionExpression: "auditId = :aid",
        ExpressionAttributeValues: { ":aid": auditId },
      })
    );
    return (res.Items || []) as Notice[];
  }
}

export const storage = new DynamoStorage();
