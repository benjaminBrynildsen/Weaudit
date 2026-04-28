import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { runAuditScan } from "./engine/runner";
import { requireAuth } from "./auth/middleware";

const upload = multer({
  dest: path.resolve("uploads"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Gate every /api/* route behind authentication. Unauthenticated
  // requests get a 401 and the client redirects to /login.
  app.use("/api", requireAuth);

  // ── Audits ──────────────────────────────────────────────────────────────────

  app.post("/api/audits", async (req: Request, res: Response) => {
    try {
      const { clientName, processor, statementMonth, mid, gatewayLevel } = req.body;
      const audit = await storage.createAudit({
        clientName: clientName || "Unknown Client",
        processor: processor || "Unknown",
        statementMonth: statementMonth || "",
        mid: mid || "",
        status: "idle",
        gatewayLevel: gatewayLevel === "II" || gatewayLevel === "III" ? gatewayLevel : undefined,
      });
      res.status(201).json(audit);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/audits", async (_req: Request, res: Response) => {
    try {
      const audits = await storage.listAudits();
      res.json(audits);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/audits/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const audit = await storage.getAudit(id);
      if (!audit) return res.status(404).json({ error: "Audit not found" });

      const findings = await storage.getFindingsByAudit(id);
      const statements = await storage.getStatementsByAudit(id);
      const notices = await storage.getNoticesByAudit(id);

      res.json({ ...audit, findings, statements, notices });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.patch("/api/audits/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const audit = await storage.updateAudit(id, req.body);
      if (!audit) return res.status(404).json({ error: "Audit not found" });
      res.json(audit);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Upload ──────────────────────────────────────────────────────────────────

  app.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const { clientName, processor, statementMonth, mid, gatewayLevel } = req.body;

      // Create audit
      const audit = await storage.createAudit({
        clientName: clientName || file.originalname,
        processor: processor || "Unknown",
        statementMonth: statementMonth || "",
        mid: mid || "",
        status: "idle",
        gatewayLevel: gatewayLevel === "II" || gatewayLevel === "III" ? gatewayLevel : undefined,
      });

      // Create statement record
      const ext = path.extname(file.originalname).toLowerCase();
      const statement = await storage.createStatement({
        auditId: audit.auditId,
        fileName: file.originalname,
        filePath: file.path,
        fileType: ext === ".csv" ? "csv" : "pdf",
      });

      // Trigger scan asynchronously
      runAuditScan(audit.auditId).catch((e) =>
        console.error("Background scan error:", e)
      );

      res.status(201).json({ audit, statement });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Bulk Upload ────────────────────────────────────────────────────────────

  app.post("/api/upload/bulk", upload.array("files", 50), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });

      const { processor, statementMonth, gatewayLevel } = req.body;
      const results: Array<{ audit: any; statement: any }> = [];

      for (const file of files) {
        const ext = path.extname(file.originalname).toLowerCase();
        const audit = await storage.createAudit({
          clientName: file.originalname,
          processor: processor || "Unknown",
          statementMonth: statementMonth || "",
          mid: "",
          status: "idle",
          gatewayLevel: gatewayLevel === "II" || gatewayLevel === "III" ? gatewayLevel : undefined,
        });

        const statement = await storage.createStatement({
          auditId: audit.auditId,
          fileName: file.originalname,
          filePath: file.path,
          fileType: ext === ".csv" ? "csv" : "pdf",
        });

        // Fire off scan asynchronously
        runAuditScan(audit.auditId).catch((e) =>
          console.error("Bulk scan error:", e)
        );

        results.push({ audit, statement });
      }

      res.status(201).json({ uploads: results });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Statements ──────────────────────────────────────────────────────────────

  app.get("/api/statements/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const statement = await storage.getStatement(id);
      if (!statement) return res.status(404).json({ error: "Statement not found" });
      res.json(statement);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Serve the uploaded statement file (PDF/CSV)
  app.get("/api/statements/:id/file", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const statement = await storage.getStatement(id);
      if (!statement) return res.status(404).json({ error: "Statement not found" });
      if (!statement.filePath || !fs.existsSync(statement.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      const contentType = statement.fileType === "csv" ? "text/csv" : "application/pdf";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${statement.fileName}"`);
      fs.createReadStream(statement.filePath).pipe(res);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Scan ────────────────────────────────────────────────────────────────────

  app.post("/api/audits/:id/scan", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const audit = await storage.getAudit(id);
      if (!audit) return res.status(404).json({ error: "Audit not found" });

      // Run scan asynchronously
      runAuditScan(id).catch((e) =>
        console.error("Background scan error:", e)
      );

      res.json({ message: "Scan started", auditId: id });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/audits/:id/status", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const audit = await storage.getAudit(id);
      if (!audit) return res.status(404).json({ error: "Audit not found" });
      res.json({
        auditId: audit.auditId,
        status: audit.status,
        errorMessage: audit.errorMessage,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Findings ────────────────────────────────────────────────────────────────

  app.get("/api/findings", async (req: Request, res: Response) => {
    try {
      const auditId = req.query.auditId as string;
      if (!auditId) return res.status(400).json({ error: "auditId query param required" });
      const findings = await storage.getFindingsByAudit(auditId);
      res.json(findings);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.patch("/api/findings/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const finding = await storage.updateFinding(id, req.body);
      if (!finding) return res.status(404).json({ error: "Finding not found" });
      res.json(finding);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Downgrade Rules ─────────────────────────────────────────────────────────

  app.get("/api/downgrade-rules", async (_req: Request, res: Response) => {
    try {
      const rules = await storage.listDowngradeRules();
      res.json(rules);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/downgrade-rules", async (req: Request, res: Response) => {
    try {
      const rule = await storage.createDowngradeRule(req.body);
      res.status(201).json(rule);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.patch("/api/downgrade-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const rule = await storage.updateDowngradeRule(id, req.body);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      res.json(rule);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.delete("/api/downgrade-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteDowngradeRule(id);
      res.json({ deleted: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Processor ISOs ──────────────────────────────────────────────────────────

  app.get("/api/processor-isos", async (_req: Request, res: Response) => {
    try {
      const isos = await storage.listProcessorISOs();
      res.json(isos);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/processor-isos", async (req: Request, res: Response) => {
    try {
      const iso = await storage.createProcessorISO(req.body);
      res.status(201).json(iso);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.patch("/api/processor-isos/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const iso = await storage.updateProcessorISO(id, req.body);
      if (!iso) return res.status(404).json({ error: "ISO not found" });
      res.json(iso);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.delete("/api/processor-isos/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteProcessorISO(id);
      res.json({ deleted: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Unknown Fees ────────────────────────────────────────────────────────────

  app.patch("/api/unknown-fees/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const uf = await storage.updateUnknownFee(id, req.body);
      if (!uf) return res.status(404).json({ error: "Unknown fee not found" });
      res.json(uf);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Notices ─────────────────────────────────────────────────────────────────

  app.post("/api/notices", async (req: Request, res: Response) => {
    try {
      const { auditId, type, amount, message } = req.body;
      if (!auditId) return res.status(400).json({ error: "auditId required" });
      const notice = await storage.createNotice({
        auditId,
        type: type || "general",
        amount: amount || 0,
        message: message || "",
      });
      res.status(201).json(notice);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/notices", async (req: Request, res: Response) => {
    try {
      const auditId = req.query.auditId as string;
      if (!auditId) return res.status(400).json({ error: "auditId query param required" });
      const notices = await storage.getNoticesByAudit(auditId);
      res.json(notices);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Companies ─────────────────────────────────────────────────────────────

  app.get("/api/companies", async (_req: Request, res: Response) => {
    try {
      const companies = await storage.listCompanies();
      res.json(companies);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/companies", async (req: Request, res: Response) => {
    try {
      const company = await storage.createCompany(req.body);
      res.status(201).json(company);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const company = await storage.getCompany(id);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json(company);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.patch("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const company = await storage.updateCompany(id, req.body);
      if (!company) return res.status(404).json({ error: "Company not found" });
      res.json(company);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.delete("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await storage.deleteCompany(id);
      res.json({ deleted: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Reports ─────────────────────────────────────────────────────────────────

  app.get("/api/reports/:auditId", async (req: Request, res: Response) => {
    try {
      const auditId = req.params.auditId as string;
      const audit = await storage.getAudit(auditId);
      if (!audit) return res.status(404).json({ error: "Audit not found" });

      const findings = await storage.getFindingsByAudit(auditId);
      const notices = await storage.getNoticesByAudit(auditId);

      const nonPciFindings = findings.filter((f) => f.type === "non_pci" && f.status !== "false_positive");
      const downgradeFindings = findings.filter(
        (f) => f.type === "downgrade" && f.status !== "false_positive" && !f.needsReview,
      );
      const serviceChargeFindings = findings.filter((f) => f.type === "service_charge" && f.status !== "false_positive");
      // Interchange lines: unknown findings with rates (actual qualification data)
      const interchangeFindings = findings.filter((f) => f.type === "unknown" && f.rate > 0);

      const totalNonPci = nonPciFindings.reduce((sum, f) => sum + f.amount, 0);
      const totalDowngrade = downgradeFindings.reduce((sum, f) => sum + (f.spread || 0), 0);
      const totalServiceChargeOvercharges = serviceChargeFindings
        .filter((f) => f.spread != null && f.spread > 0)
        .reduce((sum, f) => {
          // spread is a rate delta — convert to dollars: (charge / chargedRate) × delta
          const overchargeDollars = f.rate > 0 ? f.amount * f.spread! / f.rate : 0;
          return sum + overchargeDollars;
        }, 0);
      const totalRecovery = totalNonPci + totalDowngrade + totalServiceChargeOvercharges;

      const money = (n: number) =>
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

      // Group downgrade findings by rule name for report table
      // f.spread is now stored as estimated revenue lost in dollars
      // f.transactionCount, when present, is the underlying # of transactions
      // Amanda recorded for that row in her audit PDF; otherwise we default
      // to 1 (one finding row = one transaction on a raw statement).
      const sevRank = (s: string) => s === "High" ? 0 : s === "Medium" ? 1 : 2;
      const downgradeGroups = new Map<string, { count: number; volume: number; rate: string; revenueLost: number; reasons: string; severity: string }>();
      for (const f of downgradeFindings) {
        const key = f.title;
        const rateSpread = (f.rate && f.targetRate) ? Math.max(0, f.rate - f.targetRate) : 0;
        const txCount = f.transactionCount ?? 1;
        const existing = downgradeGroups.get(key);
        if (existing) {
          existing.count += txCount;
          existing.volume += f.amount;
          existing.revenueLost += f.spread || 0;
          if (sevRank(f.severity) < sevRank(existing.severity)) existing.severity = f.severity;
        } else {
          downgradeGroups.set(key, {
            count: txCount,
            volume: f.amount,
            rate: rateSpread > 0 ? `+${rateSpread.toFixed(2)}%` : "—",
            revenueLost: f.spread || 0,
            reasons: f.reason,
            severity: f.severity,
          });
        }
      }

      const statusMap: Record<string, "Complete" | "Needs Review" | "In Progress"> = {
        complete: "Complete",
        needs_review: "Needs Review",
        scanning: "In Progress",
        idle: "In Progress",
      };

      // Use adjusted volume/fees (total minus AMEX) per training docs
      const adjustedVolume = (audit.totalVolume || 0) - (audit.amexVolume || 0);
      const adjustedFees = (audit.totalFees || 0) - (audit.amexFees || 0);

      res.json({
        auditId: audit.auditId,
        merchant: audit.clientName,
        location: "Main location",
        statementMonth: audit.statementMonth,
        processor: audit.processor,
        mid: audit.mid,
        volume: adjustedVolume > 0 ? money(adjustedVolume) : "$0.00",
        totalFees: adjustedFees > 0 ? money(adjustedFees) : "$0.00",
        amexVolume: audit.amexVolume ? money(audit.amexVolume) : undefined,
        amexFees: audit.amexFees ? money(audit.amexFees) : undefined,
        status: statusMap[audit.status] || "In Progress",
        summary: {
          discountSavings: money(totalRecovery * 0.42),
          revenueLost: money(totalRecovery),
        },
        flags: {
          nonPci: nonPciFindings.length,
          downgrades: downgradeFindings.length,
          serviceCharges: serviceChargeFindings.length,
          serviceChargeOvercharges: serviceChargeFindings.filter((f) => f.spread != null && f.spread > 0).length,
          interchange: interchangeFindings.length,
        },
        findings: {
          nonPci: nonPciFindings.length > 0
            ? [{
                label: "Non-PCI fee",
                count: nonPciFindings.reduce((s, f) => s + (f.transactionCount ?? 1), 0),
                volume: "$0",
                rate: "—",
                revenueLost: money(totalNonPci),
                reasons: "Fee classified as non-PCI / compliance unrelated",
              }]
            : [],
          downgrades: Array.from(downgradeGroups.entries()).map(([label, g]) => ({
            label,
            count: g.count,
            volume: money(g.volume),
            rate: g.rate,
            revenueLost: money(g.revenueLost),
            reasons: g.reasons,
            severity: g.severity,
          })),
          serviceCharges: serviceChargeFindings.map((f) => ({
            label: f.title,
            rawLine: f.rawLine,
            chargedRate: f.rate,
            contractedRate: f.targetRate ?? 0,
            overcharge: f.spread != null && f.spread > 0,
            overchargeAmount: (f.spread && f.rate > 0) ? f.amount * f.spread / f.rate : 0,
            severity: f.severity,
          })),
          interchange: interchangeFindings.map((f) => ({
            label: f.rawLine || f.title,
            volume: money(f.amount),
            rate: f.rate > 0 ? `${f.rate.toFixed(2)}%` : "—",
            page: f.page,
          })),
        },
        notices,
        notes: "For best results, compare flagged lines to the processor's pricing schedule and interchange categories.",
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return httpServer;
}
