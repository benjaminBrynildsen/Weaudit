import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type GatewayLevel = "II" | "III";

/**
 * Minimum-info "Add company" dialog used by the post-scan prompt on
 * BulkAudit and Dashboard. The full Company editor lives on /companies;
 * this is the fast path so a freshly-scanned audit can be linked to a
 * Companies row in one click without leaving the page you're on.
 */

export interface AddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Defaults harvested from the audit that triggered the prompt. Each
  // field is editable in the dialog before submit.
  defaultName?: string;
  defaultMid?: string;
  defaultProcessor?: string;
  defaultGatewayLevel?: GatewayLevel;
  // Audit that prompted the create. When supplied, the server backfills
  // this audit's MID with the canonical one we're about to save (mirrors
  // the in-scan partial-MID promotion in runner.ts) and — when the user
  // changed the gateway level — patches + rescans the audit so the row
  // on the page picks up the corrected level without a manual re-upload.
  fromAuditId?: string;
  onCreated?: (company: { companyId: string; name: string; mid: string }, opts: { gatewayLevel: GatewayLevel; rescanStarted: boolean }) => void;
}

export default function AddCompanyDialog({
  open,
  onOpenChange,
  defaultName,
  defaultMid,
  defaultProcessor,
  defaultGatewayLevel,
  fromAuditId,
  onCreated,
}: AddCompanyDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName ?? "");
  const [mid, setMid] = useState(defaultMid ?? "");
  const [aliases, setAliases] = useState("");
  const [gatewayLevel, setGatewayLevel] = useState<GatewayLevel>(defaultGatewayLevel ?? "II");
  const [submitting, setSubmitting] = useState(false);

  // Refresh form fields when the dialog opens against a different audit.
  useEffect(() => {
    if (open) {
      setName(defaultName ?? "");
      setMid(defaultMid ?? "");
      setAliases("");
      setGatewayLevel(defaultGatewayLevel ?? "II");
    }
  }, [open, defaultName, defaultMid, defaultGatewayLevel]);

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Give the company a name before saving.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Send the same minimum the Companies page sends, with sensible
      // defaults for the fee/rate fields (the user can fill them in on
      // /companies later).
      const body = {
        fromAuditId,
        name: name.trim(),
        mid: mid.trim(),
        dba: name.trim(),
        aliases: aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        auditLevel: gatewayLevel === "III" ? "Level III" : "Level II",
        auditor: "",
        paymentMethod: "",
        csm: "",
        csmPhone: "",
        sendTo: "",
        discountRate: 0,
        transactionFee: 0,
        amexFee: 0,
        statementFee: 0,
        avsFee: 0,
        regFee: 0,
        chargebackFee: 0,
        authFee: 0,
        annualFee: 0,
        monitoringFee: 0,
        pciFee: 0,
        gateway: "",
        gatewayFee: 0,
        gatewayTransFee: 0,
        processor: defaultProcessor ?? "",
        statementObtainMethod: "",
        password: "",
        validationStatus: "",
        riskLevel: "",
        adjustedEffectiveRate: 0,
        actualOldEffectiveRate: 0,
        taxExempt: false,
      };
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Save failed (${res.status})`);
      }
      const company = await res.json();

      // If the chosen level differs from what the audit already has,
      // patch + rescan so the row on the page reflects the right rule
      // set without a manual re-upload. The level the dialog opens with
      // is the audit's current level, so any change means a real switch.
      const levelChanged = !!fromAuditId && gatewayLevel !== (defaultGatewayLevel ?? "II");
      if (levelChanged) {
        try {
          await fetch(`/api/audits/${fromAuditId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gatewayLevel }),
            credentials: "include",
          });
          await fetch(`/api/audits/${fromAuditId}/scan`, {
            method: "POST",
            credentials: "include",
          });
        } catch (e) {
          // Non-fatal: company saved, just couldn't kick the rescan.
          console.warn("Rescan after level change failed:", e);
        }
      }

      toast({
        title: "Company added",
        description: levelChanged
          ? `${company.name} saved. Re-scanning at Level ${gatewayLevel}…`
          : `${company.name} is in the database.`,
      });
      onCreated?.(company, { gatewayLevel, rescanStarted: levelChanged });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Couldn't save company",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Add company to database
          </DialogTitle>
          <DialogDescription>
            Saves a minimal record so this merchant matches automatically on future audits. You can fill in fees and contacts on the Companies page later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="add-co-name">Company name</Label>
            <Input
              id="add-co-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Productivity Inc"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-co-mid">MID</Label>
            <Input
              id="add-co-mid"
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              placeholder="737191030888"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Use the full MID from the processor statement when you have it. Partial / trailing-digit MIDs from internal audit reports will be auto-promoted on next match.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-co-aliases">Aliases (comma-separated)</Label>
            <Input
              id="add-co-aliases"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="PRODUCTIVITY, Productivity Inc (1 of 3)"
            />
            <p className="text-xs text-muted-foreground">
              Optional — alternate names this merchant appears under in statements.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-co-level">Gateway level</Label>
            <Select value={gatewayLevel} onValueChange={(v) => setGatewayLevel(v as GatewayLevel)}>
              <SelectTrigger id="add-co-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="II">Level II</SelectItem>
                <SelectItem value="III">Level III</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Saved on the company so future audits auto-detect, and applied to this audit (rescans if changed).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? "Saving…" : "Add company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
