import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  // Audit that prompted the create. When supplied, the server backfills
  // this audit's MID with the canonical one we're about to save (mirrors
  // the in-scan partial-MID promotion in runner.ts).
  fromAuditId?: string;
  onCreated?: (company: { companyId: string; name: string; mid: string }) => void;
}

export default function AddCompanyDialog({
  open,
  onOpenChange,
  defaultName,
  defaultMid,
  defaultProcessor,
  fromAuditId,
  onCreated,
}: AddCompanyDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName ?? "");
  const [mid, setMid] = useState(defaultMid ?? "");
  const [aliases, setAliases] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Refresh form fields when the dialog opens against a different audit.
  useEffect(() => {
    if (open) {
      setName(defaultName ?? "");
      setMid(defaultMid ?? "");
      setAliases("");
    }
  }, [open, defaultName, defaultMid]);

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
        auditLevel: "Level II",
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
      toast({ title: "Company added", description: `${company.name} is in the database.` });
      onCreated?.(company);
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
