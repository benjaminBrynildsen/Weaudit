import type { Audit, Company } from "../storage";

/**
 * Match an audit to a row in the Companies table using the same rules
 * the runner applies during scan: prefer MID (bidirectional `endsWith`
 * so a partial 4-digit MID from one of Amanda's audit-report PDFs lines
 * up with a 12-digit company MID), then fall back to a normalized
 * substring match on company name / DBA / aliases.
 *
 * Pulled out of runner.ts so the same logic is available to the API
 * routes that surface "needs company" hints to the client.
 */
export function matchAuditToCompany(
  audit: Pick<Audit, "mid" | "clientName" | "dba"> | undefined,
  companies: Company[],
): Company | undefined {
  if (!audit) return undefined;

  return companies.find((c) => {
    // 1. MID match — most reliable signal. Strip non-digits both sides
    //    and accept either-direction suffix containment.
    if (audit.mid && c.mid) {
      const auditMid = audit.mid.replace(/\D/g, "");
      const companyMid = c.mid.replace(/\D/g, "");
      if (
        companyMid.length > 0 &&
        (auditMid === companyMid ||
          auditMid.endsWith(companyMid) ||
          companyMid.endsWith(auditMid))
      ) {
        return true;
      }
    }

    // 2. Name/DBA fallback. Normalize separators so SHORE_DISTRIBUTORS,
    //    "Shore-Distributors", and "Shore Distributors" all match.
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[_\-\.,]+/g, " ").replace(/\s+/g, " ").trim();

    const candidates = [audit.clientName, audit.dba]
      .filter((v): v is string => !!v && v.length > 0)
      .map(normalize);
    if (candidates.length === 0) return false;

    const companyHaystacks = [c.name, c.dba, ...(c.aliases ?? [])]
      .filter((v): v is string => !!v && v.length > 0)
      .map(normalize);

    return candidates.some((cand) =>
      companyHaystacks.some((hay) => hay.includes(cand) || cand.includes(hay)),
    );
  });
}
