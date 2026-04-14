/**
 * Postgres implementation of IStorage.
 *
 * Behavioral parity with DynamoStorage is the goal — same method signatures,
 * same return shapes, same sort orders. Routes and business logic do not
 * need to know which backend is active.
 */

import { eq, desc, asc } from "drizzle-orm";
import { getDb } from "./pg";
import {
  audits as auditsT,
  statements as statementsT,
  findings as findingsT,
  downgradeRules as downgradeRulesT,
  processorIsos as processorIsosT,
  unknownFees as unknownFeesT,
  notices as noticesT,
  companies as companiesT,
} from "./schema";
import type {
  Audit,
  Statement,
  Finding,
  DowngradeRule,
  ProcessorISO,
  UnknownFee,
  Notice,
  Company,
  IStorage,
} from "../storage-types";

// Helpers to strip `null` fields from DB rows so that optional properties
// end up as `undefined` (matching the TS interface / DynamoStorage behavior).
function stripNulls<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null) out[k] = v;
  }
  return out as T;
}

export class PostgresStorage implements IStorage {
  private get db() {
    return getDb();
  }

  // ── Audits ──

  async createAudit(data: Omit<Audit, "auditId" | "createdAt">): Promise<Audit> {
    const [row] = await this.db
      .insert(auditsT)
      .values({ ...data, createdAt: new Date().toISOString() })
      .returning();
    return stripNulls(row) as Audit;
  }

  async getAudit(auditId: string): Promise<Audit | undefined> {
    const rows = await this.db.select().from(auditsT).where(eq(auditsT.auditId, auditId));
    return rows[0] ? (stripNulls(rows[0]) as Audit) : undefined;
  }

  async listAudits(): Promise<Audit[]> {
    const rows = await this.db
      .select()
      .from(auditsT)
      .orderBy(desc(auditsT.createdAt));
    return rows.map((r) => stripNulls(r) as Audit);
  }

  async updateAudit(auditId: string, patch: Partial<Audit>): Promise<Audit | undefined> {
    // Strip primary key from patch so it can't be overwritten
    const { auditId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(auditsT)
      .set(rest)
      .where(eq(auditsT.auditId, auditId))
      .returning();
    return row ? (stripNulls(row) as Audit) : undefined;
  }

  // ── Statements ──

  async createStatement(data: Omit<Statement, "statementId" | "uploadedAt">): Promise<Statement> {
    const [row] = await this.db
      .insert(statementsT)
      .values({ ...data, uploadedAt: new Date().toISOString() })
      .returning();
    return stripNulls(row) as Statement;
  }

  async getStatement(statementId: string): Promise<Statement | undefined> {
    const rows = await this.db
      .select()
      .from(statementsT)
      .where(eq(statementsT.statementId, statementId));
    return rows[0] ? (stripNulls(rows[0]) as Statement) : undefined;
  }

  async getStatementsByAudit(auditId: string): Promise<Statement[]> {
    const rows = await this.db
      .select()
      .from(statementsT)
      .where(eq(statementsT.auditId, auditId));
    return rows.map((r) => stripNulls(r) as Statement);
  }

  // ── Findings ──

  async createFinding(data: Omit<Finding, "findingId">): Promise<Finding> {
    const [row] = await this.db.insert(findingsT).values(data).returning();
    return stripNulls(row) as Finding;
  }

  async getFinding(findingId: string): Promise<Finding | undefined> {
    const rows = await this.db
      .select()
      .from(findingsT)
      .where(eq(findingsT.findingId, findingId));
    return rows[0] ? (stripNulls(rows[0]) as Finding) : undefined;
  }

  async getFindingsByAudit(auditId: string): Promise<Finding[]> {
    const rows = await this.db
      .select()
      .from(findingsT)
      .where(eq(findingsT.auditId, auditId));
    return rows.map((r) => stripNulls(r) as Finding);
  }

  async updateFinding(findingId: string, patch: Partial<Finding>): Promise<Finding | undefined> {
    const { findingId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(findingsT)
      .set(rest)
      .where(eq(findingsT.findingId, findingId))
      .returning();
    return row ? (stripNulls(row) as Finding) : undefined;
  }

  async deleteFindingsByAudit(auditId: string): Promise<void> {
    await this.db.delete(findingsT).where(eq(findingsT.auditId, auditId));
  }

  async deleteUnknownFeesByAudit(auditId: string): Promise<void> {
    await this.db.delete(unknownFeesT).where(eq(unknownFeesT.auditId, auditId));
  }

  // ── Downgrade Rules ──

  async listDowngradeRules(): Promise<DowngradeRule[]> {
    const rows = await this.db.select().from(downgradeRulesT);
    return rows.map((r) => stripNulls(r) as DowngradeRule);
  }

  async getDowngradeRule(ruleId: string): Promise<DowngradeRule | undefined> {
    const rows = await this.db
      .select()
      .from(downgradeRulesT)
      .where(eq(downgradeRulesT.ruleId, ruleId));
    return rows[0] ? (stripNulls(rows[0]) as DowngradeRule) : undefined;
  }

  async createDowngradeRule(data: Omit<DowngradeRule, "ruleId">): Promise<DowngradeRule> {
    const [row] = await this.db.insert(downgradeRulesT).values(data).returning();
    return stripNulls(row) as DowngradeRule;
  }

  async updateDowngradeRule(ruleId: string, patch: Partial<DowngradeRule>): Promise<DowngradeRule | undefined> {
    const { ruleId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(downgradeRulesT)
      .set(rest)
      .where(eq(downgradeRulesT.ruleId, ruleId))
      .returning();
    return row ? (stripNulls(row) as DowngradeRule) : undefined;
  }

  async deleteDowngradeRule(ruleId: string): Promise<void> {
    await this.db.delete(downgradeRulesT).where(eq(downgradeRulesT.ruleId, ruleId));
  }

  // ── Processor ISOs ──

  async listProcessorISOs(): Promise<ProcessorISO[]> {
    const rows = await this.db.select().from(processorIsosT);
    return rows.map((r) => stripNulls(r) as ProcessorISO);
  }

  async getProcessorISO(isoId: string): Promise<ProcessorISO | undefined> {
    const rows = await this.db
      .select()
      .from(processorIsosT)
      .where(eq(processorIsosT.isoId, isoId));
    return rows[0] ? (stripNulls(rows[0]) as ProcessorISO) : undefined;
  }

  async createProcessorISO(data: Omit<ProcessorISO, "isoId">): Promise<ProcessorISO> {
    const [row] = await this.db.insert(processorIsosT).values(data).returning();
    return stripNulls(row) as ProcessorISO;
  }

  async updateProcessorISO(isoId: string, patch: Partial<ProcessorISO>): Promise<ProcessorISO | undefined> {
    const { isoId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(processorIsosT)
      .set(rest)
      .where(eq(processorIsosT.isoId, isoId))
      .returning();
    return row ? (stripNulls(row) as ProcessorISO) : undefined;
  }

  async deleteProcessorISO(isoId: string): Promise<void> {
    await this.db.delete(processorIsosT).where(eq(processorIsosT.isoId, isoId));
  }

  // ── Unknown Fees ──

  async getUnknownFee(unknownFeeId: string): Promise<UnknownFee | undefined> {
    const rows = await this.db
      .select()
      .from(unknownFeesT)
      .where(eq(unknownFeesT.unknownFeeId, unknownFeeId));
    return rows[0] ? (stripNulls(rows[0]) as UnknownFee) : undefined;
  }

  async getUnknownFeesByAudit(auditId: string): Promise<UnknownFee[]> {
    const rows = await this.db
      .select()
      .from(unknownFeesT)
      .where(eq(unknownFeesT.auditId, auditId));
    return rows.map((r) => stripNulls(r) as UnknownFee);
  }

  async createUnknownFee(data: Omit<UnknownFee, "unknownFeeId">): Promise<UnknownFee> {
    const [row] = await this.db.insert(unknownFeesT).values(data).returning();
    return stripNulls(row) as UnknownFee;
  }

  async updateUnknownFee(unknownFeeId: string, patch: Partial<UnknownFee>): Promise<UnknownFee | undefined> {
    const { unknownFeeId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(unknownFeesT)
      .set(rest)
      .where(eq(unknownFeesT.unknownFeeId, unknownFeeId))
      .returning();
    return row ? (stripNulls(row) as UnknownFee) : undefined;
  }

  // ── Notices ──

  async createNotice(data: Omit<Notice, "noticeId" | "createdAt">): Promise<Notice> {
    const [row] = await this.db
      .insert(noticesT)
      .values({ ...data, createdAt: new Date().toISOString() })
      .returning();
    return stripNulls(row) as Notice;
  }

  async getNoticesByAudit(auditId: string): Promise<Notice[]> {
    const rows = await this.db
      .select()
      .from(noticesT)
      .where(eq(noticesT.auditId, auditId));
    return rows.map((r) => stripNulls(r) as Notice);
  }

  // ── Companies ──

  async listCompanies(): Promise<Company[]> {
    const rows = await this.db
      .select()
      .from(companiesT)
      .orderBy(asc(companiesT.name));
    return rows.map((r) => stripNulls(r) as Company);
  }

  async getCompany(companyId: string): Promise<Company | undefined> {
    const rows = await this.db
      .select()
      .from(companiesT)
      .where(eq(companiesT.companyId, companyId));
    return rows[0] ? (stripNulls(rows[0]) as Company) : undefined;
  }

  async createCompany(data: Omit<Company, "companyId" | "createdAt" | "updatedAt">): Promise<Company> {
    const now = new Date().toISOString();
    const [row] = await this.db
      .insert(companiesT)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return stripNulls(row) as Company;
  }

  async updateCompany(companyId: string, patch: Partial<Company>): Promise<Company | undefined> {
    const { companyId: _ignore, ...rest } = patch;
    const [row] = await this.db
      .update(companiesT)
      .set({ ...rest, updatedAt: new Date().toISOString() })
      .where(eq(companiesT.companyId, companyId))
      .returning();
    return row ? (stripNulls(row) as Company) : undefined;
  }

  async deleteCompany(companyId: string): Promise<void> {
    await this.db.delete(companiesT).where(eq(companiesT.companyId, companyId));
  }
}
