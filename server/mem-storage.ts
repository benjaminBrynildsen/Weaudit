import { randomUUID } from "crypto";
import type {
  IStorage,
  Audit,
  Statement,
  Finding,
  DowngradeRule,
  ProcessorISO,
  UnknownFee,
  Notice,
  Company,
} from "./storage";

export class MemStorage implements IStorage {
  private audits = new Map<string, Audit>();
  private statements = new Map<string, Statement>();
  private findings = new Map<string, Finding>();
  private downgradeRules = new Map<string, DowngradeRule>();
  private processorISOs = new Map<string, ProcessorISO>();
  private unknownFees = new Map<string, UnknownFee>();
  private notices = new Map<string, Notice>();
  private companies = new Map<string, Company>();

  // ── Audits ──
  async createAudit(data: Omit<Audit, "auditId" | "createdAt">): Promise<Audit> {
    const audit: Audit = { ...data, auditId: randomUUID(), createdAt: new Date().toISOString() };
    this.audits.set(audit.auditId, audit);
    return audit;
  }
  async getAudit(auditId: string) { return this.audits.get(auditId); }
  async listAudits() {
    return [...this.audits.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async updateAudit(auditId: string, patch: Partial<Audit>) {
    const existing = this.audits.get(auditId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, auditId };
    this.audits.set(auditId, merged);
    return merged;
  }

  // ── Statements ──
  async createStatement(data: Omit<Statement, "statementId" | "uploadedAt">): Promise<Statement> {
    const s: Statement = { ...data, statementId: randomUUID(), uploadedAt: new Date().toISOString() };
    this.statements.set(s.statementId, s);
    return s;
  }
  async getStatement(statementId: string) { return this.statements.get(statementId); }
  async getStatementsByAudit(auditId: string) {
    return [...this.statements.values()].filter(s => s.auditId === auditId);
  }

  // ── Findings ──
  async createFinding(data: Omit<Finding, "findingId">): Promise<Finding> {
    const f: Finding = { ...data, findingId: randomUUID() };
    this.findings.set(f.findingId, f);
    return f;
  }
  async getFinding(findingId: string) { return this.findings.get(findingId); }
  async getFindingsByAudit(auditId: string) {
    return [...this.findings.values()].filter(f => f.auditId === auditId);
  }
  async updateFinding(findingId: string, patch: Partial<Finding>) {
    const existing = this.findings.get(findingId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, findingId };
    this.findings.set(findingId, merged);
    return merged;
  }
  async deleteFindingsByAudit(auditId: string) {
    for (const [id, f] of this.findings) {
      if (f.auditId === auditId) this.findings.delete(id);
    }
  }

  // ── Unknown Fees ──
  async deleteUnknownFeesByAudit(auditId: string) {
    for (const [id, f] of this.unknownFees) {
      if (f.auditId === auditId) this.unknownFees.delete(id);
    }
  }
  async getUnknownFee(unknownFeeId: string) { return this.unknownFees.get(unknownFeeId); }
  async getUnknownFeesByAudit(auditId: string) {
    return [...this.unknownFees.values()].filter(f => f.auditId === auditId);
  }
  async createUnknownFee(data: Omit<UnknownFee, "unknownFeeId">): Promise<UnknownFee> {
    const uf: UnknownFee = { ...data, unknownFeeId: randomUUID() };
    this.unknownFees.set(uf.unknownFeeId, uf);
    return uf;
  }
  async updateUnknownFee(unknownFeeId: string, patch: Partial<UnknownFee>) {
    const existing = this.unknownFees.get(unknownFeeId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, unknownFeeId };
    this.unknownFees.set(unknownFeeId, merged);
    return merged;
  }

  // ── Downgrade Rules ──
  async listDowngradeRules() { return [...this.downgradeRules.values()]; }
  async getDowngradeRule(ruleId: string) { return this.downgradeRules.get(ruleId); }
  async createDowngradeRule(data: Omit<DowngradeRule, "ruleId">): Promise<DowngradeRule> {
    const rule: DowngradeRule = {
      ...data,
      ruleId: randomUUID(),
      createdAt: data.createdAt || new Date().toISOString(),
    };
    this.downgradeRules.set(rule.ruleId, rule);
    return rule;
  }
  async updateDowngradeRule(ruleId: string, patch: Partial<DowngradeRule>) {
    const existing = this.downgradeRules.get(ruleId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, ruleId };
    this.downgradeRules.set(ruleId, merged);
    return merged;
  }
  async deleteDowngradeRule(ruleId: string) { this.downgradeRules.delete(ruleId); }

  // ── Processor ISOs ──
  async listProcessorISOs() { return [...this.processorISOs.values()]; }
  async getProcessorISO(isoId: string) { return this.processorISOs.get(isoId); }
  async createProcessorISO(data: Omit<ProcessorISO, "isoId">): Promise<ProcessorISO> {
    const iso: ProcessorISO = { ...data, isoId: randomUUID() };
    this.processorISOs.set(iso.isoId, iso);
    return iso;
  }
  async updateProcessorISO(isoId: string, patch: Partial<ProcessorISO>) {
    const existing = this.processorISOs.get(isoId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, isoId };
    this.processorISOs.set(isoId, merged);
    return merged;
  }
  async deleteProcessorISO(isoId: string) { this.processorISOs.delete(isoId); }

  // ── Notices ──
  async createNotice(data: Omit<Notice, "noticeId" | "createdAt">): Promise<Notice> {
    const notice: Notice = { ...data, noticeId: randomUUID(), createdAt: new Date().toISOString() };
    this.notices.set(notice.noticeId, notice);
    return notice;
  }
  async getNoticesByAudit(auditId: string) {
    return [...this.notices.values()].filter(n => n.auditId === auditId);
  }

  // ── Companies ──
  async listCompanies() {
    return [...this.companies.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getCompany(companyId: string) { return this.companies.get(companyId); }
  async createCompany(data: Omit<Company, "companyId" | "createdAt" | "updatedAt">): Promise<Company> {
    const now = new Date().toISOString();
    const company: Company = { ...data, companyId: randomUUID(), createdAt: now, updatedAt: now };
    this.companies.set(company.companyId, company);
    return company;
  }
  async updateCompany(companyId: string, patch: Partial<Company>) {
    const existing = this.companies.get(companyId);
    if (!existing) return undefined;
    const merged = { ...existing, ...patch, companyId, updatedAt: new Date().toISOString() };
    this.companies.set(companyId, merged);
    return merged;
  }
  async deleteCompany(companyId: string) { this.companies.delete(companyId); }
}
