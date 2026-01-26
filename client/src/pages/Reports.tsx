import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Download,
  Link2,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  FileWarning,
  Users,
  Building2,
  BadgePercent,
  CircleDashed,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type CompletionStatus = "Missing" | "In Progress" | "Complete";

type MonthlyRow = {
  id: string;
  client: string;
  processor: string;
  month: string;
  mid: string;
  status: CompletionStatus;
  losses: string;
  notes: string;
};

const initialRows: MonthlyRow[] = [
  {
    id: "r-1",
    client: "Acme Coffee Roasters",
    processor: "CardConnect",
    month: "2024-01",
    mid: "MID-0042187",
    status: "In Progress",
    losses: "$0",
    notes: "Waiting on PCI attestation confirmation",
  },
  {
    id: "r-2",
    client: "Northside Auto",
    processor: "Fiserv",
    month: "2024-01",
    mid: "MID-0081144",
    status: "Missing",
    losses: "$0",
    notes: "No statement uploaded yet",
  },
  {
    id: "r-3",
    client: "Sunset Dental",
    processor: "VersaPay",
    month: "2024-01",
    mid: "MID-0017740",
    status: "Complete",
    losses: "$499 annual fee (refund requested)",
    notes: "One-time notice included in report",
  },
];

export default function Reports() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MonthlyRow[]>(initialRows);

  const [noticeClient, setNoticeClient] = useState("Sunset Dental");
  const [noticeMonth, setNoticeMonth] = useState("2024-01");
  const [noticeText, setNoticeText] = useState(
    "We found an annual fee was charged to this account in the amount of $499 and have requested a refund on your behalf.",
  );

  const generate = (kind: string) => {
    toast({ title: "Generated (mock)", description: `${kind} is ready for download/share.` });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 data-testid="text-reports-title" className="text-3xl font-bold font-heading tracking-tight">
              Reports & Admin
            </h1>
            <p data-testid="text-reports-subtitle" className="text-muted-foreground mt-1">
              Generate monthly reports, track completion, and produce client exception lists.
            </p>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-generate-monthly-report" onClick={() => generate("Monthly report")}
              className="shadow-lg shadow-primary/20">
              <FileText className="mr-2 h-4 w-4" />
              Generate report
            </Button>
          </div>
        </div>

        <Tabs defaultValue="monthly" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger data-testid="tab-reports-monthly" value="monthly">
              Monthly Reports
            </TabsTrigger>
            <TabsTrigger data-testid="tab-reports-completion" value="completion">
              Completion Tracking
            </TabsTrigger>
            <TabsTrigger data-testid="tab-reports-exceptions" value="exceptions">
              Exceptions
            </TabsTrigger>
            <TabsTrigger data-testid="tab-reports-integrations" value="integrations">
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold" data-testid="text-monthly-builder-title">
                      Monthly report builder
                    </p>
                    <p className="text-xs text-muted-foreground">Includes executive summary, findings, and evidence appendix.</p>
                  </div>
                  <Badge data-testid="badge-report-status" variant="outline" className="text-muted-foreground">
                    Draft
                  </Badge>
                </div>

                <Separator className="my-4" />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" data-testid="text-nonpci-card-title">
                          Non-PCI fees report
                        </p>
                        <p className="text-xs text-muted-foreground">Automatically generated each month per statement.</p>
                      </div>
                    </div>
                    <Button data-testid="button-generate-nonpci" variant="outline" className="w-full mt-3" onClick={() => generate("Non-PCI fees report")}
                    >
                      <Download className="w-4 h-4 mr-2" /> Download PDF
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <FileWarning className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" data-testid="text-one-time-notices-title">
                          One-time notices
                        </p>
                        <p className="text-xs text-muted-foreground">Add custom messages when annual/one-off fees appear.</p>
                      </div>
                    </div>
                    <Button data-testid="button-open-notices" variant="outline" className="w-full mt-3" onClick={() => generate("Notices preview")}
                    >
                      <Link2 className="w-4 h-4 mr-2" /> Preview
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/20 p-4 sm:col-span-2">
                    <p className="text-sm font-semibold" data-testid="text-notice-editor-title">
                      Add a notice to a statement
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Anyone on the team can create a notice. This message appears only for the matching statement month.
                    </p>

                    <div className="grid sm:grid-cols-3 gap-3 mt-4">
                      <div className="space-y-2">
                        <Label>Client</Label>
                        <Input data-testid="input-notice-client" value={noticeClient} onChange={(e) => setNoticeClient(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Statement month</Label>
                        <Input
                          data-testid="input-notice-month"
                          type="month"
                          value={noticeMonth}
                          onChange={(e) => setNoticeMonth(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <div className="h-10 rounded-md border border-border bg-background flex items-center px-3 text-sm">
                          Annual fee
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-3">
                      <Label>Message</Label>
                      <Textarea data-testid="textarea-notice-message" value={noticeText} onChange={(e) => setNoticeText(e.target.value)} />
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button data-testid="button-save-notice" onClick={() => generate("Notice saved")}
                      >
                        Save notice
                      </Button>
                      <Button data-testid="button-add-to-report" variant="outline" onClick={() => generate("Notice added to report")}
                      >
                        Add to report
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <p className="font-semibold" data-testid="text-report-actions-title">
                  Report actions
                </p>
                <p className="text-xs text-muted-foreground">Export formats and sharing.</p>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Button data-testid="button-export-pdf" variant="outline" className="w-full" onClick={() => generate("PDF export")}
                  >
                    <Download className="w-4 h-4 mr-2" /> Export PDF
                  </Button>
                  <Button data-testid="button-export-csv" variant="outline" className="w-full" onClick={() => generate("CSV export")}
                  >
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
                  <Button data-testid="button-share-link" className="w-full" onClick={() => generate("Share link")}
                  >
                    <Link2 className="w-4 h-4 mr-2" /> Create share link
                  </Button>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-semibold" data-testid="text-report-warning-title">
                    Benchmarking disclaimer
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Benchmarks support findings but are not guaranteed savings.
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="completion" className="mt-6 space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p data-testid="text-completion-title" className="font-semibold">
                    Tracking completion & missing audits
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Notifies missing audits by MID and generates a monthly exception report.
                  </p>
                </div>
                <Button data-testid="button-generate-missing-audits" variant="outline" onClick={() => generate("Missing audits report")}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" /> Generate report
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-3">
                {rows.map((r) => (
                  <div key={r.id} data-testid={`row-completion-${r.id}`} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-client-${r.id}`}>
                          {r.client}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {r.processor} • {r.month} • MID: <span className="font-mono">{r.mid}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          data-testid={`badge-status-${r.id}`}
                          variant="outline"
                          className={
                            r.status === "Complete"
                              ? "bg-green-500/10 text-green-600 border-green-500/20"
                              : r.status === "Missing"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                          }
                        >
                          {r.status}
                        </Badge>
                        <Button
                          data-testid={`button-mark-complete-${r.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, status: "Complete" } : x)),
                            )
                          }
                        >
                          <ClipboardCheck className="w-4 h-4 mr-2" /> Mark complete
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                      <div className="rounded-md border border-border bg-secondary/20 p-3">
                        <p className="text-[11px] text-muted-foreground">Losses (auditor sheet)</p>
                        <p className="text-sm mt-1" data-testid={`text-losses-${r.id}`}>
                          {r.losses}
                        </p>
                      </div>
                      <div className="rounded-md border border-border bg-secondary/20 p-3">
                        <p className="text-[11px] text-muted-foreground">Notes</p>
                        <p className="text-sm mt-1" data-testid={`text-notes-${r.id}`}>
                          {r.notes}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-border bg-secondary/10 p-4">
                <p className="text-sm font-semibold" data-testid="text-notify-note-title">
                  Notifications (mock)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  In the real app, we can notify your team when a MID is missing an audit for a given month.
                </p>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="exceptions" className="mt-6 space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="p-5 lg:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p data-testid="text-exceptions-title" className="font-semibold">
                      Overbilling / rate mismatch client list
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generate a report with client names, processors, and current rates (Fiserv / VersaPay).
                    </p>
                  </div>
                  <Button data-testid="button-generate-overbilling" onClick={() => generate("Overbilling client list")}
                  >
                    <BadgePercent className="w-4 h-4 mr-2" /> Generate
                  </Button>
                </div>

                <Separator className="my-4" />

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Clients flagged</p>
                    <p className="text-2xl font-bold font-heading" data-testid="text-flagged-count">
                      18
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Processors</p>
                    <p className="text-2xl font-bold font-heading" data-testid="text-flagged-processors">
                      2
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">Avg variance</p>
                    <p className="text-2xl font-bold font-heading" data-testid="text-avg-variance">
                      0.22%
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-secondary/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" data-testid="text-exception-note-title">
                        What’s included
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Client name • processor • current rate • expected rate • MID • statement month • evidence line item.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <p className="font-semibold" data-testid="text-exception-actions-title">
                  Quick exports
                </p>
                <p className="text-xs text-muted-foreground">Mock destinations (UI only).</p>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Button data-testid="button-export-exceptions-pdf" variant="outline" className="w-full" onClick={() => generate("Exceptions PDF")}
                  >
                    <Download className="w-4 h-4 mr-2" /> PDF
                  </Button>
                  <Button data-testid="button-export-exceptions-csv" variant="outline" className="w-full" onClick={() => generate("Exceptions CSV")}
                  >
                    <Download className="w-4 h-4 mr-2" /> CSV
                  </Button>
                  <Button data-testid="button-export-exceptions-share" className="w-full" onClick={() => generate("Exceptions share link")}
                  >
                    <Link2 className="w-4 h-4 mr-2" /> Share link
                  </Button>
                </div>

                <div className="mt-4 rounded-lg border border-border bg-secondary/20 p-4">
                  <p className="text-sm font-semibold" data-testid="text-destination-note-title">
                    Destinations
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We’ll add Doc Hub / Google / Zoho destinations next once you confirm which one to prioritize.
                  </p>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6 space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold" data-testid="text-integrations-title">
                    Integrations (placeholder)
                  </p>
                  <p className="text-xs text-muted-foreground">Mock connectors for Doc Hub / Google / Zoho.</p>
                </div>
                <Badge data-testid="badge-integrations" variant="outline" className="text-muted-foreground">
                  Coming soon
                </Badge>
              </div>

              <Separator className="my-4" />

              <div className="grid md:grid-cols-3 gap-4">
                {[{
                  icon: FileText,
                  title: "Doc Hub",
                  desc: "Auto-publish reports to an internal doc hub.",
                  testid: "card-integration-dochub",
                }, {
                  icon: Users,
                  title: "Google Drive/Sheets",
                  desc: "Export completion + exceptions to Sheets.",
                  testid: "card-integration-google",
                }, {
                  icon: Building2,
                  title: "Zoho",
                  desc: "Push reports into Zoho docs or CRM.",
                  testid: "card-integration-zoho",
                }].map((i) => (
                  <div key={i.testid} data-testid={i.testid} className="rounded-lg border border-border bg-secondary/20 p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <i.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{i.title}</p>
                        <p className="text-xs text-muted-foreground">{i.desc}</p>
                      </div>
                    </div>
                    <Button data-testid={`button-connect-${i.testid}`} variant="outline" className="w-full mt-3" onClick={() => generate(`${i.title} connect`)}>
                      <CircleDashed className="w-4 h-4 mr-2" /> Connect
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
