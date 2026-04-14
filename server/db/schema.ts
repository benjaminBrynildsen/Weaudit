/**
 * Postgres schema (Drizzle). Mirrors the TypeScript types in ../storage.ts
 * as closely as possible so the same domain objects flow through the rest
 * of the app unchanged.
 *
 * Notes:
 *  - Timestamps stay as ISO text (not timestamp columns) because the rest
 *    of the code treats them as strings. Changing that is a separate refactor.
 *  - Enum-like unions (AuditStatus, FindingType, etc.) are stored as text.
 *    We assert their narrow types when reading, matching current behavior.
 *  - Arrays (levelTags, keywords, aliases) use native Postgres text arrays.
 */

import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  index,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AuditStatus,
  FindingType,
  FindingStatus,
  UnknownFeeApproval,
} from "../storage-types";

export const audits = pgTable("audits", {
  auditId: uuid("audit_id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  processor: text("processor").notNull(),
  statementMonth: text("statement_month").notNull(),
  mid: text("mid").notNull(),
  status: text("status").$type<AuditStatus>().notNull(),
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
  totalVolume: real("total_volume"),
  totalFees: real("total_fees"),
  amexVolume: real("amex_volume"),
  amexFees: real("amex_fees"),
  effectiveRate: real("effective_rate"),
  dba: text("dba"),
  statementPeriod: text("statement_period"),
  processorDetected: text("processor_detected"),
  gatewayLevel: text("gateway_level").$type<"II" | "III">(),
});

export const statements = pgTable(
  "statements",
  {
    statementId: uuid("statement_id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id").notNull(),
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    fileType: text("file_type").$type<"pdf" | "csv">().notNull(),
    rawText: text("raw_text"),
    uploadedAt: text("uploaded_at").notNull(),
  },
  (t) => ({
    byAudit: index("idx_statements_audit_id").on(t.auditId),
  }),
);

export const findings = pgTable(
  "findings",
  {
    findingId: uuid("finding_id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id").notNull(),
    type: text("type").$type<FindingType>().notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    rawLine: text("raw_line").notNull(),
    amount: real("amount").notNull(),
    rate: real("rate").notNull(),
    page: integer("page").notNull(),
    lineNum: integer("line_num").notNull(),
    severity: text("severity").$type<"High" | "Medium" | "Low">().notNull(),
    confidence: text("confidence").$type<"High" | "Medium" | "Low">().notNull(),
    status: text("status").$type<FindingStatus>().notNull(),
    reason: text("reason").notNull(),
    recommendedAction: text("recommended_action").notNull(),
    targetRate: real("target_rate"),
    spread: real("spread"),
    priority: integer("priority"),
  },
  (t) => ({
    byAudit: index("idx_findings_audit_id").on(t.auditId),
  }),
);

export const downgradeRules = pgTable("downgrade_rules", {
  ruleId: uuid("rule_id").primaryKey().defaultRandom(),
  brand: text("brand").$type<"V" | "M">().notNull(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  reason: text("reason").notNull(),
  targetRate: real("target_rate").notNull(),
  levelTags: text("level_tags").array().notNull(),
  keywords: text("keywords").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  informational: boolean("informational").notNull().default(false),
});

export const processorIsos = pgTable("processor_isos", {
  isoId: uuid("iso_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  aliases: text("aliases").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const unknownFees = pgTable(
  "unknown_fees",
  {
    unknownFeeId: uuid("unknown_fee_id").primaryKey().defaultRandom(),
    findingId: uuid("finding_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    rawLine: text("raw_line").notNull(),
    amount: real("amount").notNull(),
    approvalStatus: text("approval_status").$type<UnknownFeeApproval>().notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
  },
  (t) => ({
    byFinding: index("idx_unknown_fees_finding_id").on(t.findingId),
    byAudit: index("idx_unknown_fees_audit_id").on(t.auditId),
  }),
);

export const notices = pgTable(
  "notices",
  {
    noticeId: uuid("notice_id").primaryKey().defaultRandom(),
    auditId: uuid("audit_id").notNull(),
    type: text("type").notNull(),
    amount: real("amount").notNull(),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    byAudit: index("idx_notices_audit_id").on(t.auditId),
  }),
);

export const companies = pgTable("companies", {
  companyId: uuid("company_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  auditLevel: text("audit_level").notNull(),
  auditor: text("auditor").notNull(),
  paymentMethod: text("payment_method").notNull(),
  csm: text("csm").notNull(),
  csmPhone: text("csm_phone").notNull(),
  sendTo: text("send_to").notNull(),
  discountRate: real("discount_rate").notNull(),
  transactionFee: real("transaction_fee").notNull(),
  amexFee: real("amex_fee").notNull(),
  statementFee: real("statement_fee").notNull(),
  avsFee: real("avs_fee").notNull(),
  regFee: real("reg_fee").notNull(),
  chargebackFee: real("chargeback_fee").notNull(),
  authFee: real("auth_fee").notNull(),
  annualFee: real("annual_fee").notNull(),
  monitoringFee: real("monitoring_fee").notNull(),
  pciFee: real("pci_fee").notNull(),
  gateway: text("gateway").notNull(),
  gatewayFee: real("gateway_fee").notNull(),
  gatewayTransFee: real("gateway_trans_fee").notNull(),
  processor: text("processor").notNull(),
  statementObtainMethod: text("statement_obtain_method").notNull(),
  password: text("password").notNull(),
  validationStatus: text("validation_status").notNull(),
  riskLevel: text("risk_level").notNull(),
  adjustedEffectiveRate: real("adjusted_effective_rate").notNull(),
  actualOldEffectiveRate: real("actual_old_effective_rate").notNull(),
});
