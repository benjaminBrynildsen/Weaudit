import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronsUpDown,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type ProcessorISO = {
  id: string;
  name: string;
  aliases: string[];
  enabled: boolean;
};

type DowngradeRule = {
  id: string;
  brand: "V" | "M";
  name: string;
  rate: number;
  levelTags: Array<"II" | "III">;
  keywords: string[];
  enabled: boolean;
};

const initialIsos: ProcessorISO[] = [
  { id: "iso-fiserv", name: "Fiserv", aliases: ["First Data"], enabled: true },
  { id: "iso-cardconnect", name: "CardConnect", aliases: ["CardPointe"], enabled: true },
  { id: "iso-north-summit", name: "North Summit", aliases: ["NS"], enabled: true },
  { id: "iso-cocard", name: "CoCard", aliases: ["Co Card"], enabled: true },
  { id: "iso-cardone", name: "Cardone", aliases: ["Card One"], enabled: true },
  { id: "iso-boa", name: "Bank of America", aliases: ["BOA", "BofA"], enabled: true },
  { id: "iso-wf", name: "Wells Fargo", aliases: ["WF"], enabled: true },
  { id: "iso-versapay", name: "VersaPay", aliases: ["Versa Pay"], enabled: true },
  { id: "iso-solupay", name: "Solupay", aliases: ["Solu Pay"], enabled: true },
  { id: "iso-pnc-key", name: "PNC / KeyBank", aliases: ["PNC", "KeyBank"], enabled: true },
];

const baseKeywordsLevelII = ["EIRF", "STANDARD", "STD", "NON QUAL", "NON-QUAL", "PRODUCT 1", "CNP", "DATA RATE 1"];
const baseKeywordsLevelIII = ["DATA RATE 2", "LEVEL II"];

const initialRules: DowngradeRule[] = [
  {
    id: "r-v-eirf-non-cps-all-other",
    brand: "V",
    name: "EIRF NON CPS ALL OTHER",
    rate: 2.3,
    levelTags: ["II", "III"],
    keywords: ["EIRF", "NON CPS", "ALL OTHER"],
    enabled: true,
  },
  {
    id: "r-v-eirf-non-cps-all-other-db",
    brand: "V",
    name: "EIRF NON CPS ALL OTHER (DB)",
    rate: 1.75,
    levelTags: ["II", "III"],
    keywords: ["EIRF", "DB", "NON CPS"],
    enabled: true,
  },
  {
    id: "r-v-standard",
    brand: "V",
    name: "Standard",
    rate: 2.95,
    levelTags: ["II", "III"],
    keywords: ["STANDARD", "STD"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-corp-credit",
    brand: "V",
    name: "Non-Qual Corp Credit",
    rate: 2.95,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "CORP", "CREDIT"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-crp-data",
    brand: "V",
    name: "Non-Qual CRP Data",
    rate: 2.95,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "CRP", "DATA"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-purch-credit",
    brand: "V",
    name: "Non-Qual Purch Credit",
    rate: 2.95,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "PURCH", "CREDIT"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-purch-data",
    brand: "V",
    name: "Non-Qual Purch Data",
    rate: 2.95,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "PURCH", "DATA"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-biz-credit",
    brand: "V",
    name: "Non-Qual Business Credit",
    rate: 3.15,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "BUSINESS", "CREDIT"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-consumer-data",
    brand: "V",
    name: "Non-Qual Consumer Data",
    rate: 2.7,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "CONSUMER", "DATA"],
    enabled: true,
  },
  {
    id: "r-v-nonqual-consumer-credit",
    brand: "V",
    name: "Non-Qual Consumer Credit",
    rate: 3.15,
    levelTags: ["II", "III"],
    keywords: ["NON QUAL", "CONSUMER", "CREDIT"],
    enabled: true,
  },
  {
    id: "r-v-business-t1-product1",
    brand: "V",
    name: "Business T1 Product 1",
    rate: 2.65,
    levelTags: ["II", "III"],
    keywords: ["BUSINESS", "T1", "PRODUCT 1"],
    enabled: true,
  },
  {
    id: "r-v-corporate-card-cnp",
    brand: "V",
    name: "CORPORATE CARD CNP",
    rate: 2.7,
    levelTags: ["II", "III"],
    keywords: ["CORPORATE", "CNP"],
    enabled: true,
  },
  {
    id: "r-v-purch-card-cnp",
    brand: "V",
    name: "PURCHASING CARD CNP",
    rate: 2.7,
    levelTags: ["II", "III"],
    keywords: ["PURCHASING", "CNP"],
    enabled: true,
  },
  {
    id: "r-v-purch-level2",
    brand: "V",
    name: "PURCHASING LEVEL II",
    rate: 2.5,
    levelTags: ["II", "III"],
    keywords: ["PURCHASING", "LEVEL II"],
    enabled: true,
  },

  {
    id: "r-m-business-card-std",
    brand: "M",
    name: "BUSINESS CARD STD",
    rate: 3.15,
    levelTags: ["II", "III"],
    keywords: ["BUSINESS", "STD"],
    enabled: true,
  },
  {
    id: "r-m-corp-data-rate-1-us-bus",
    brand: "M",
    name: "CORP DATA RATE I (US) BUS",
    rate: 2.65,
    levelTags: ["II", "III"],
    keywords: ["DATA RATE 1", "CORP", "BUS"],
    enabled: true,
  },
  {
    id: "r-m-corp-data-rate-ii-us-corp",
    brand: "M",
    name: "CORP DATA RATE II (US) CORP",
    rate: 2.5,
    levelTags: ["III"],
    keywords: ["DATA RATE 2", "CORP"],
    enabled: true,
  },
  {
    id: "r-m-business-level-5-standard",
    brand: "M",
    name: "BUSINESS LEVEL 5 STANDARD",
    rate: 3.3,
    levelTags: ["III"],
    keywords: ["BUSINESS", "LEVEL 5", "STANDARD"],
    enabled: true,
  },
];

function chip(text: string) {
  return (
    <span
      key={text}
      className="inline-flex items-center rounded-md border border-border bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground"
    >
      {text}
    </span>
  );
}

export default function Review() {
  const [isoQuery, setIsoQuery] = useState("");
  const [ruleQuery, setRuleQuery] = useState("");
  const [isos, setIsos] = useState<ProcessorISO[]>(initialIsos);
  const [rules, setRules] = useState<DowngradeRule[]>(initialRules);

  const [editingIsoId, setEditingIsoId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const filteredIsos = useMemo(() => {
    const q = isoQuery.trim().toLowerCase();
    if (!q) return isos;
    return isos.filter((i) => {
      if (i.name.toLowerCase().includes(q)) return true;
      if (i.aliases.some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [isoQuery, isos]);

  const filteredRules = useMemo(() => {
    const q = ruleQuery.trim().toLowerCase();
    if (!q) return rules;
    return rules.filter((r) => {
      const hay = `${r.brand} ${r.name} ${r.rate} ${r.keywords.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [ruleQuery, rules]);

  const enabledRuleCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const enabledIsoCount = useMemo(() => isos.filter((i) => i.enabled).length, [isos]);

  const toggleIso = (id: string) => {
    setIsos((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));
  };

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const updateIso = (id: string, patch: Partial<ProcessorISO>) => {
    setIsos((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const updateRule = (id: string, patch: Partial<DowngradeRule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addIso = () => {
    const id = `iso-${Math.random().toString(16).slice(2)}`;
    const created: ProcessorISO = { id, name: "New ISO", aliases: [], enabled: true };
    setIsos((prev) => [created, ...prev]);
    setEditingIsoId(id);
  };

  const addRule = () => {
    const id = `r-${Math.random().toString(16).slice(2)}`;
    const created: DowngradeRule = {
      id,
      brand: "V",
      name: "New downgrade",
      rate: 0,
      levelTags: ["II"],
      keywords: ["KEYWORD"],
      enabled: true,
    };
    setRules((prev) => [created, ...prev]);
    setEditingRuleId(id);
  };

  const deleteIso = (id: string) => {
    setIsos((prev) => prev.filter((i) => i.id !== id));
    if (editingIsoId === id) setEditingIsoId(null);
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingRuleId === id) setEditingRuleId(null);
  };

  const levelKeywordPreview = (tags: DowngradeRule["levelTags"]) => {
    const base = [...baseKeywordsLevelII];
    if (tags.includes("III")) base.push(...baseKeywordsLevelIII);
    return base.slice(0, 8);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h1 data-testid="text-review-title" className="text-3xl font-bold font-heading tracking-tight">
              Admin Database
            </h1>
            <p data-testid="text-review-subtitle" className="text-muted-foreground mt-1">
              Manage processor ISOs and downgrade detection rules used by the audit engine.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge data-testid="badge-enabled-isos" variant="outline" className="text-muted-foreground">
              {enabledIsoCount}/{isos.length} ISOs enabled
            </Badge>
            <Badge data-testid="badge-enabled-rules" variant="outline" className="text-muted-foreground">
              {enabledRuleCount}/{rules.length} downgrade rules enabled
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="processors" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger data-testid="tab-settings-processors" value="processors">
              Processors
            </TabsTrigger>
            <TabsTrigger data-testid="tab-settings-downgrades" value="downgrades">
              Downgrades
            </TabsTrigger>
            <TabsTrigger data-testid="tab-settings-keywords" value="keywords">
              Keywords
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processors" className="mt-6 space-y-6">
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p data-testid="text-iso-title" className="font-semibold">
                    Processor ISO list
                  </p>
                  <p data-testid="text-iso-subtitle" className="text-xs text-muted-foreground mt-1">
                    Used during Classify to map statements to the right rule pack.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-iso-search"
                      value={isoQuery}
                      onChange={(e) => setIsoQuery(e.target.value)}
                      placeholder="Search ISOs…"
                      className="pl-9"
                    />
                  </div>
                  <Button data-testid="button-iso-add" onClick={addIso} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {filteredIsos.map((iso) => {
                  const isEditing = editingIsoId === iso.id;
                  return (
                    <div
                      key={iso.id}
                      className="rounded-xl border border-border bg-secondary/10 p-4 transition-colors hover:bg-secondary/15"
                      data-testid={`card-iso-${iso.id}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              data-testid={`badge-iso-enabled-${iso.id}`}
                              variant="outline"
                              className={
                                iso.enabled
                                  ? "text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : "text-[11px] bg-muted text-muted-foreground border-border"
                              }
                            >
                              {iso.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            <p data-testid={`text-iso-name-${iso.id}`} className="font-semibold truncate">
                              {iso.name}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2" data-testid={`list-iso-aliases-${iso.id}`}>
                            {iso.aliases.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No aliases</span>
                            ) : (
                              iso.aliases.map((a) => chip(a))
                            )}
                          </div>

                          {isEditing && (
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Display name</Label>
                                <Input
                                  data-testid={`input-iso-name-${iso.id}`}
                                  value={iso.name}
                                  onChange={(e) => updateIso(iso.id, { name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Aliases (comma separated)</Label>
                                <Input
                                  data-testid={`input-iso-aliases-${iso.id}`}
                                  value={iso.aliases.join(", ")}
                                  onChange={(e) =>
                                    updateIso(iso.id, {
                                      aliases: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="First Data, CardPointe, …"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            data-testid={`button-iso-toggle-${iso.id}`}
                            variant="outline"
                            className="h-9"
                            onClick={() => toggleIso(iso.id)}
                          >
                            {iso.enabled ? "Disable" : "Enable"}
                          </Button>

                          <Button
                            data-testid={`button-iso-edit-${iso.id}`}
                            variant={isEditing ? "default" : "outline"}
                            className="h-9"
                            onClick={() => setEditingIsoId((v) => (v === iso.id ? null : iso.id))}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> {isEditing ? "Done" : "Edit"}
                          </Button>

                          <Button
                            data-testid={`button-iso-delete-${iso.id}`}
                            variant="outline"
                            className="h-9 text-destructive hover:text-destructive"
                            onClick={() => deleteIso(iso.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredIsos.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <p data-testid="text-iso-empty" className="text-sm font-semibold">
                      No processors found
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="downgrades" className="mt-6 space-y-6">
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <p data-testid="text-downgrade-rules-title" className="font-semibold">
                    Downgrade list
                  </p>
                  <p data-testid="text-downgrade-rules-subtitle" className="text-xs text-muted-foreground mt-1">
                    Toggle rules on/off, edit keywords, and adjust rates.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-downgrade-search"
                      value={ruleQuery}
                      onChange={(e) => setRuleQuery(e.target.value)}
                      placeholder="Search downgrades…"
                      className="pl-9"
                    />
                  </div>
                  <Button data-testid="button-downgrade-add" onClick={addRule} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {filteredRules.map((r) => {
                  const isEditing = editingRuleId === r.id;
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border bg-secondary/10 p-4 transition-colors hover:bg-secondary/15"
                      data-testid={`card-downgrade-${r.id}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              data-testid={`badge-rule-enabled-${r.id}`}
                              variant="outline"
                              className={
                                r.enabled
                                  ? "text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : "text-[11px] bg-muted text-muted-foreground border-border"
                              }
                            >
                              {r.enabled ? "Enabled" : "Disabled"}
                            </Badge>

                            <Badge
                              data-testid={`badge-rule-brand-${r.id}`}
                              variant="outline"
                              className="text-[11px] bg-background/60 text-muted-foreground border-border"
                            >
                              {r.brand === "V" ? "Visa" : "Mastercard"}
                            </Badge>

                            <p data-testid={`text-rule-name-${r.id}`} className="font-semibold">
                              {r.brand} - {r.name}
                            </p>

                            <span className="text-xs text-muted-foreground">·</span>

                            <p data-testid={`text-rule-rate-${r.id}`} className="font-mono text-xs">
                              {r.rate.toFixed(2)}%
                            </p>

                            <span className="text-xs text-muted-foreground">·</span>

                            <Badge
                              data-testid={`badge-rule-levels-${r.id}`}
                              variant="outline"
                              className="text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                            >
                              Level {r.levelTags.join("+")}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2" data-testid={`list-rule-keywords-${r.id}`}>
                            {r.keywords.map((k) => chip(k))}
                          </div>

                          {isEditing && (
                            <div className="mt-4 grid gap-3">
                              <div className="grid sm:grid-cols-3 gap-3">
                                <div className="space-y-2">
                                  <Label>Brand</Label>
                                  <div className="h-10 rounded-md border border-border bg-background/60 px-3 flex items-center text-sm">
                                    {r.brand === "V" ? "Visa" : "Mastercard"}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Name</Label>
                                  <Input
                                    data-testid={`input-rule-name-${r.id}`}
                                    value={r.name}
                                    onChange={(e) => updateRule(r.id, { name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Rate (%)</Label>
                                  <Input
                                    data-testid={`input-rule-rate-${r.id}`}
                                    value={String(r.rate)}
                                    onChange={(e) =>
                                      updateRule(r.id, {
                                        rate: Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : 0,
                                      })
                                    }
                                  />
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-3 gap-3">
                                <div className="space-y-2">
                                  <Label>Levels</Label>
                                  <div className="h-10 rounded-md border border-border bg-background/60 px-3 flex items-center justify-between">
                                    <span className="text-sm">{r.levelTags.join("+")}</span>
                                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    (Mock) This control will become multi-select.
                                  </p>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                  <Label>Keywords (comma separated)</Label>
                                  <Input
                                    data-testid={`input-rule-keywords-${r.id}`}
                                    value={r.keywords.join(", ")}
                                    onChange={(e) =>
                                      updateRule(r.id, {
                                        keywords: e.target.value
                                          .split(",")
                                          .map((s) => s.trim())
                                          .filter(Boolean),
                                      })
                                    }
                                  />
                                  <p className="text-[11px] text-muted-foreground">
                                    Match is case-insensitive and token-based in the real engine.
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-lg border border-border bg-background/60 p-3">
                                <div className="flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold" data-testid={`text-rule-preview-title-${r.id}`}>
                                      Level keyword preview
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-rule-preview-body-${r.id}`}>
                                      With levels {r.levelTags.join("+")}, we also watch for:
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2" data-testid={`list-rule-preview-${r.id}`}>
                                      {levelKeywordPreview(r.levelTags).map((k) => chip(k))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            data-testid={`button-rule-toggle-${r.id}`}
                            variant="outline"
                            className="h-9"
                            onClick={() => toggleRule(r.id)}
                          >
                            {r.enabled ? "Disable" : "Enable"}
                          </Button>

                          <Button
                            data-testid={`button-rule-edit-${r.id}`}
                            variant={isEditing ? "default" : "outline"}
                            className="h-9"
                            onClick={() => setEditingRuleId((v) => (v === r.id ? null : r.id))}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> {isEditing ? "Done" : "Edit"}
                          </Button>

                          <Button
                            data-testid={`button-rule-delete-${r.id}`}
                            variant="outline"
                            className="h-9 text-destructive hover:text-destructive"
                            onClick={() => deleteRule(r.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredRules.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <p data-testid="text-downgrade-empty" className="text-sm font-semibold">
                      No downgrades found
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="keywords" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p data-testid="text-keywords-level2-title" className="font-semibold">
                      Level II keywords
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-keywords-level2-subtitle">
                      Common tokens that typically indicate downgrades.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground" data-testid="badge-keywords-level2">
                    {baseKeywordsLevelII.length}
                  </Badge>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2" data-testid="list-keywords-level2">
                  {baseKeywordsLevelII.map((k) => chip(k))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p data-testid="text-keywords-level3-title" className="font-semibold">
                      Level III keywords
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-keywords-level3-subtitle">
                      Level III includes Level II keywords plus additional tokens.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground" data-testid="badge-keywords-level3">
                    {baseKeywordsLevelIII.length}
                  </Badge>
                </div>
                <Separator className="my-4" />
                <div className="flex flex-wrap gap-2" data-testid="list-keywords-level3">
                  {baseKeywordsLevelIII.map((k) => chip(k))}
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p data-testid="text-keywords-how-title" className="font-semibold">
                      How matching works (prototype)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-keywords-how-body">
                      We tokenize statement lines and look for strong matches across ISO aliases + downgrade rule keywords.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-muted-foreground" data-testid="badge-keywords-engine">
                      Case-insensitive
                    </Badge>
                    <Badge variant="outline" className="text-muted-foreground" data-testid="badge-keywords-token">
                      Token-based
                    </Badge>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="rounded-lg border border-border bg-secondary/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" data-testid="text-keywords-example-title">
                        Example
                      </p>
                      <p className="text-sm text-muted-foreground mt-1" data-testid="text-keywords-example-line">
                        "VISA CPS RETAIL KEYED (DOWNGRADE) 2.95% + $0.20"
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2" data-testid="list-keywords-example-tokens">
                        {[
                          "VISA",
                          "CPS",
                          "RETAIL",
                          "KEYED",
                          "DOWNGRADE",
                          "2.95%",
                          ...baseKeywordsLevelII.slice(0, 2),
                        ].map((k) => chip(k))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" data-testid="text-keywords-tip-title">
                        Tip
                      </p>
                      <p className="text-sm text-emerald-800/80 mt-1" data-testid="text-keywords-tip-body">
                        Start with ISO detection (Fiserv/CardConnect/etc.), then apply only that processor’s downgrade rules.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
