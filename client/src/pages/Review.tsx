import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  useDowngradeRules,
  useProcessorISOs,
  useCreateDowngradeRule,
  useUpdateDowngradeRule,
  useDeleteDowngradeRule,
  useCreateProcessorISO,
  useUpdateProcessorISO,
  useDeleteProcessorISO,
} from "@/lib/api";
import type { DowngradeRule, ProcessorISO } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
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
import { useMemo, useState, useEffect, useRef } from "react";

/** Numeric input that allows intermediate values like "1." or "0.0" while editing */
function NumericInput({
  value,
  onCommit,
  ...props
}: { value: number; onCommit: (n: number) => void } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur">) {
  const [raw, setRaw] = useState(String(value));
  const committed = useRef(value);
  useEffect(() => {
    // Only sync from outside if the committed value changed externally
    if (value !== committed.current) {
      committed.current = value;
      setRaw(String(value));
    }
  }, [value]);
  return (
    <Input
      {...props}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => {
        const n = Number(raw);
        const final = Number.isFinite(n) ? n : 0;
        committed.current = final;
        onCommit(final);
        setRaw(String(final));
      }}
    />
  );
}

const baseKeywordsLevelII = ["EIRF", "STANDARD", "STD", "NON QUAL", "NON-QUAL", "PRODUCT 1", "CNP", "DATA RATE 1"];
const baseKeywordsLevelIII = ["DATA RATE 2", "LEVEL II"];

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
  const [levelFilter, setLevelFilter] = useState<"all" | "II" | "III">("all");

  const { data: isos = [], isLoading: isLoadingIsos } = useProcessorISOs();
  const { data: rules = [], isLoading: isLoadingRules } = useDowngradeRules();

  const createIsoMutation = useCreateProcessorISO();
  const updateIsoMutation = useUpdateProcessorISO();
  const deleteIsoMutation = useDeleteProcessorISO();

  const createRuleMutation = useCreateDowngradeRule();
  const updateRuleMutation = useUpdateDowngradeRule();
  const deleteRuleMutation = useDeleteDowngradeRule();

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
    return rules.filter((r) => {
      if (levelFilter !== "all" && !r.levelTags.includes(levelFilter)) return false;
      if (!q) return true;
      const hay = `${r.brand} - ${r.name} ${r.brand} ${r.name} ${r.rate} ${r.keywords.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [ruleQuery, rules, levelFilter]);

  const enabledRuleCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules]);
  const enabledIsoCount = useMemo(() => isos.filter((i) => i.enabled).length, [isos]);

  const toggleIso = (iso: ProcessorISO) => {
    updateIsoMutation.mutate({ isoId: iso.isoId, enabled: !iso.enabled });
  };

  const toggleRule = (rule: DowngradeRule) => {
    updateRuleMutation.mutate({ ruleId: rule.ruleId, enabled: !rule.enabled });
  };

  const updateIso = (isoId: string, patch: Partial<ProcessorISO>) => {
    updateIsoMutation.mutate({ isoId, ...patch });
  };

  const updateRule = (ruleId: string, patch: Partial<DowngradeRule>) => {
    updateRuleMutation.mutate({ ruleId, ...patch });
  };

  const addIso = () => {
    createIsoMutation.mutate(
      { name: "New ISO", aliases: [], enabled: true },
      {
        onSuccess: (created: ProcessorISO) => {
          setEditingIsoId(created.isoId);
        },
      },
    );
  };

  const addRule = () => {
    createRuleMutation.mutate(
      {
        brand: "V",
        name: "New downgrade",
        rate: 0,
        reason: "",
        targetRate: 0,
        levelTags: ["II"],
        keywords: ["KEYWORD"],
        enabled: true,
      },
      {
        onSuccess: (created: DowngradeRule) => {
          setEditingRuleId(created.ruleId);
        },
      },
    );
  };

  const deleteIso = (isoId: string) => {
    deleteIsoMutation.mutate(isoId);
    if (editingIsoId === isoId) setEditingIsoId(null);
  };

  const deleteRule = (ruleId: string) => {
    deleteRuleMutation.mutate(ruleId);
    if (editingRuleId === ruleId) setEditingRuleId(null);
  };

  const levelKeywordPreview = (tags: DowngradeRule["levelTags"]) => {
    const base = [...baseKeywordsLevelII];
    if (tags.includes("III")) base.push(...baseKeywordsLevelIII);
    return base.slice(0, 8);
  };

  const isLoading = isLoadingIsos || isLoadingRules;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="size-8" />
            <p className="text-sm text-muted-foreground">Loading admin data...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

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
                  const isEditing = editingIsoId === iso.isoId;
                  return (
                    <div
                      key={iso.isoId}
                      className="rounded-xl border border-border bg-secondary/10 p-4 transition-colors hover:bg-secondary/15"
                      data-testid={`card-iso-${iso.isoId}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              data-testid={`badge-iso-enabled-${iso.isoId}`}
                              variant="outline"
                              className={
                                iso.enabled
                                  ? "text-[11px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : "text-[11px] bg-muted text-muted-foreground border-border"
                              }
                            >
                              {iso.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                            <p data-testid={`text-iso-name-${iso.isoId}`} className="font-semibold truncate">
                              {iso.name}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2" data-testid={`list-iso-aliases-${iso.isoId}`}>
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
                                  data-testid={`input-iso-name-${iso.isoId}`}
                                  value={iso.name}
                                  onChange={(e) => updateIso(iso.isoId, { name: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Aliases (comma separated)</Label>
                                <Input
                                  data-testid={`input-iso-aliases-${iso.isoId}`}
                                  value={iso.aliases.join(", ")}
                                  onChange={(e) =>
                                    updateIso(iso.isoId, {
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
                            data-testid={`button-iso-toggle-${iso.isoId}`}
                            variant="outline"
                            className="h-9"
                            onClick={() => toggleIso(iso)}
                          >
                            {iso.enabled ? "Disable" : "Enable"}
                          </Button>

                          <Button
                            data-testid={`button-iso-edit-${iso.isoId}`}
                            variant={isEditing ? "default" : "outline"}
                            className="h-9"
                            onClick={() => setEditingIsoId((v) => (v === iso.isoId ? null : iso.isoId))}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> {isEditing ? "Done" : "Edit"}
                          </Button>

                          <Button
                            data-testid={`button-iso-delete-${iso.isoId}`}
                            variant="outline"
                            className="h-9 text-destructive hover:text-destructive"
                            onClick={() => deleteIso(iso.isoId)}
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
                  <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v as "all" | "II" | "III")}>
                    <SelectTrigger data-testid="select-level-filter" className="w-[120px] shrink-0">
                      <SelectValue placeholder="Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All levels</SelectItem>
                      <SelectItem value="II">Level II</SelectItem>
                      <SelectItem value="III">Level III</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button data-testid="button-downgrade-add" onClick={addRule} className="shrink-0">
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                {filteredRules.map((r) => {
                  const isEditing = editingRuleId === r.ruleId;
                  return (
                    <div
                      key={r.ruleId}
                      className="rounded-xl border border-border bg-secondary/10 p-4 transition-colors hover:bg-secondary/15"
                      data-testid={`card-downgrade-${r.ruleId}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              data-testid={`badge-rule-enabled-${r.ruleId}`}
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
                              data-testid={`badge-rule-brand-${r.ruleId}`}
                              variant="outline"
                              className="text-[11px] bg-background/60 text-muted-foreground border-border"
                            >
                              {r.brand === "V" ? "Visa" : "Mastercard"}
                            </Badge>

                            <p data-testid={`text-rule-name-${r.ruleId}`} className="font-semibold">
                              {r.brand} - {r.name}
                            </p>

                            <span className="text-xs text-muted-foreground">·</span>

                            <p data-testid={`text-rule-rate-${r.ruleId}`} className="font-mono text-xs">
                              {r.rate.toFixed(2)}%
                            </p>

                            <span className="text-xs text-muted-foreground">·</span>

                            <Badge
                              data-testid={`badge-rule-levels-${r.ruleId}`}
                              variant="outline"
                              className="text-[11px] bg-amber-500/10 text-amber-700 border-amber-500/20"
                            >
                              Level {r.levelTags.join("+")}
                            </Badge>
                          </div>

                          {r.reason && (
                            <p className="mt-2 text-xs text-muted-foreground leading-relaxed" data-testid={`text-rule-reason-${r.ruleId}`}>
                              {r.reason}
                            </p>
                          )}

                          {r.targetRate != null && (
                            <div className="mt-2 flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">Target rate:</span>
                              <span className="font-mono text-xs font-semibold text-emerald-600" data-testid={`text-rule-target-${r.ruleId}`}>
                                {(r.targetRate ?? 0).toFixed(2)}%
                              </span>
                              <span className="text-xs text-muted-foreground">Spread:</span>
                              <span className="font-mono text-xs font-semibold text-amber-600">
                                {((r.rate ?? 0) - (r.targetRate ?? 0)).toFixed(2)}%
                              </span>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2" data-testid={`list-rule-keywords-${r.ruleId}`}>
                            {r.keywords.map((k) => chip(k))}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            <span data-testid={`text-rule-created-${r.ruleId}`}>
                              Added:{" "}
                              <span className="font-medium text-foreground/80">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                              </span>
                            </span>
                            <span data-testid={`text-rule-last-matched-${r.ruleId}`}>
                              Last matched:{" "}
                              <span className="font-medium text-foreground/80">
                                {r.lastMatchedAt ? new Date(r.lastMatchedAt).toLocaleString() : "never"}
                              </span>
                            </span>
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
                                    data-testid={`input-rule-name-${r.ruleId}`}
                                    value={r.name}
                                    onChange={(e) => updateRule(r.ruleId, { name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Rate (%)</Label>
                                  <NumericInput
                                    data-testid={`input-rule-rate-${r.ruleId}`}
                                    value={r.rate}
                                    onCommit={(n) => updateRule(r.ruleId, { rate: n })}
                                  />
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label>Reason</Label>
                                  <Input
                                    data-testid={`input-rule-reason-${r.ruleId}`}
                                    value={r.reason}
                                    onChange={(e) => updateRule(r.ruleId, { reason: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Target Rate (%)</Label>
                                  <NumericInput
                                    data-testid={`input-rule-target-${r.ruleId}`}
                                    value={r.targetRate ?? 0}
                                    onCommit={(n) => updateRule(r.ruleId, { targetRate: n })}
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
                                    data-testid={`input-rule-keywords-${r.ruleId}`}
                                    value={r.keywords.join(", ")}
                                    onChange={(e) =>
                                      updateRule(r.ruleId, {
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
                                    <p className="text-sm font-semibold" data-testid={`text-rule-preview-title-${r.ruleId}`}>
                                      Level keyword preview
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-rule-preview-body-${r.ruleId}`}>
                                      With levels {r.levelTags.join("+")}, we also watch for:
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-2" data-testid={`list-rule-preview-${r.ruleId}`}>
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
                            data-testid={`button-rule-toggle-${r.ruleId}`}
                            variant="outline"
                            className="h-9"
                            onClick={() => toggleRule(r)}
                          >
                            {r.enabled ? "Disable" : "Enable"}
                          </Button>

                          <Button
                            data-testid={`button-rule-edit-${r.ruleId}`}
                            variant={isEditing ? "default" : "outline"}
                            className="h-9"
                            onClick={() => setEditingRuleId((v) => (v === r.ruleId ? null : r.ruleId))}
                          >
                            <Pencil className="w-4 h-4 mr-2" /> {isEditing ? "Done" : "Edit"}
                          </Button>

                          <Button
                            data-testid={`button-rule-delete-${r.ruleId}`}
                            variant="outline"
                            className="h-9 text-destructive hover:text-destructive"
                            onClick={() => deleteRule(r.ruleId)}
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

              <Separator className="my-4" />

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" data-testid="text-congrats-title">Congratulations!</p>
                    <p className="text-sm text-emerald-800/80 mt-1" data-testid="text-congrats-body">
                      You have no avoidable downgrades to report this billing cycle
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-secondary/10 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" data-testid="text-canada-title">Canadian Processing Accounts</p>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-canada-body">
                      Canada does not have interchange categories, so no information will be displayed in this part of your audit.
                    </p>
                  </div>
                </div>
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
