import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpRight,
  DollarSign,
  FileText,
  AlertTriangle,
  Activity,
  Plus,
  ClipboardCheck,
  CalendarClock,
  Flag,
  Files,
} from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", fees: 2400 },
  { month: "Feb", fees: 1398 },
  { month: "Mar", fees: 9800 },
  { month: "Apr", fees: 3908 },
  { month: "May", fees: 4800 },
  { month: "Jun", fees: 3800 },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 data-testid="text-page-title" className="text-3xl font-bold font-heading tracking-tight text-foreground">
              Monthly Audits
            </h1>
            <p data-testid="text-page-subtitle" className="text-muted-foreground mt-1">
              Track completions, catch anomalies, and publish monthly reports.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/upload">
              <Button data-testid="button-upload-statement" size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 w-4 h-4" />
                Upload Statement
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Est. Annual Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div data-testid="text-est-annual-savings" className="text-2xl font-bold font-heading">
                $14,231.89
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-accent flex items-center mr-1">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" /> +12.5%
                </span>
                vs last audit
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Effective Rate</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div data-testid="text-effective-rate" className="text-2xl font-bold font-heading">
                2.84%
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-destructive flex items-center mr-1">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" /> +0.12%
                </span>
                vs benchmark
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Missing Audits</CardTitle>
              <CalendarClock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div data-testid="text-missing-audits" className="text-2xl font-bold font-heading">
                7
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across 3 processors</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Findings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div data-testid="text-open-findings" className="text-2xl font-bold font-heading">
                12
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-orange-500 font-medium mr-1">3 Critical</span>
                require attention
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-7">
          <Card className="md:col-span-4 shadow-sm">
            <CardHeader>
              <CardTitle data-testid="text-fee-trends-title">Fee Trends</CardTitle>
              <CardDescription>Monthly processing fees over time.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full" data-testid="chart-fee-trends">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="fees"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorFees)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-sm">
            <CardHeader>
              <CardTitle data-testid="text-work-queue-title">Work Queue</CardTitle>
              <CardDescription>Quick access to the monthly workflow.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="monthly" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger data-testid="tab-monthly" value="monthly" className="flex-1">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-initial" value="initial" className="flex-1">
                    Initial
                  </TabsTrigger>
                  <TabsTrigger data-testid="tab-admin" value="admin" className="flex-1">
                    Admin
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="monthly" className="mt-4 space-y-3">
                  {[{
                    icon: ClipboardCheck,
                    title: "Completion Tracking",
                    desc: "Mark audits complete and note blockers.",
                    cta: "Open",
                    href: "/reports",
                    testid: "card-completion-tracking",
                  }, {
                    icon: Flag,
                    title: "One-time Notices",
                    desc: "Add annual-fee refund notices per statement.",
                    cta: "Manage",
                    href: "/reports",
                    testid: "card-one-time-notices",
                  }, {
                    icon: AlertTriangle,
                    title: "Unknown Fees Review",
                    desc: "Approve small pass-through fees before reporting.",
                    cta: "Review",
                    href: "/reports",
                    testid: "card-unknown-fees",
                  }].map((item) => (
                    <div
                      key={item.testid}
                      data-testid={item.testid}
                      className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Button data-testid={`button-${item.testid}`} size="sm" variant="outline" asChild>
                        <Link href={item.href}>{item.cta}</Link>
                      </Button>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="initial" className="mt-4 space-y-3">
                  <div data-testid="card-initial-audit" className="p-3 rounded-lg border border-border bg-secondary/20">
                    <p className="font-medium text-sm">Initial Audits (coming next)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      We’ll add a guided intake + instant savings estimator for prospects.
                    </p>
                    <div className="mt-3">
                      <Button data-testid="button-view-initial-audit" size="sm" variant="outline" asChild>
                        <Link href="/reports">Preview Flow</Link>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="mt-4 space-y-3">
                  {[{
                    icon: Files,
                    title: "Overbilling Client List",
                    desc: "Generate client list (processor, rates, variance).",
                    testid: "card-overbilling-list",
                  }, {
                    icon: FileText,
                    title: "Auto PCI / Non-PCI Report",
                    desc: "Generate non-PCI fees into a monthly report.",
                    testid: "card-non-pci-report",
                  }].map((item) => (
                    <div
                      key={item.testid}
                      data-testid={item.testid}
                      className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Button data-testid={`button-${item.testid}`} size="sm" variant="outline" asChild>
                        <Link href="/reports">Open</Link>
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>

              <div className="mt-4">
                <Badge data-testid="badge-demo-note" variant="outline" className="text-xs text-muted-foreground">
                  Demo data in prototype
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="pt-2">
          <p data-testid="text-audit-note" className="text-xs text-muted-foreground">
            Note: effective rate in this mockup can be shown with and without AmEx volume/fees.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
