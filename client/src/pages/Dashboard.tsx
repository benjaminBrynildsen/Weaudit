import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  FileText, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Plus
} from "lucide-react";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', fees: 2400 },
  { month: 'Feb', fees: 1398 },
  { month: 'Mar', fees: 9800 },
  { month: 'Apr', fees: 3908 },
  { month: 'May', fees: 4800 },
  { month: 'Jun', fees: 3800 },
];

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight text-foreground">Executive Summary</h1>
            <p className="text-muted-foreground mt-1">Overview of your processing health and potential savings.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/upload">
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 w-4 h-4" />
                Upload Statement
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Est. Annual Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">$14,231.89</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-accent flex items-center mr-1"><ArrowUpRight className="h-3 w-3 mr-0.5" /> +12.5%</span> 
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
              <div className="text-2xl font-bold font-heading">2.84%</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-destructive flex items-center mr-1"><ArrowUpRight className="h-3 w-3 mr-0.5" /> +0.12%</span> 
                vs benchmark
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Findings</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">12</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-orange-500 font-medium mr-1">3 Critical</span> 
                require attention
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Statements Audited</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-heading">24</div>
              <p className="text-xs text-muted-foreground mt-1">
                Last upload: 2 days ago
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Recent Activity */}
        <div className="grid gap-6 md:grid-cols-7">
          <Card className="md:col-span-4 shadow-sm">
            <CardHeader>
              <CardTitle>Fee Trends</CardTitle>
              <CardDescription>Monthly processing fees vs. volume over time.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="fees" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorFees)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-sm">
            <CardHeader>
              <CardTitle>Top Findings</CardTitle>
              <CardDescription>Highest impact issues found this month.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { title: "PCI Non-Compliance Fee", impact: "$129.00/mo", severity: "high", color: "text-destructive" },
                  { title: "Tiered Downgrades Detected", impact: "$450.00/mo", severity: "medium", color: "text-orange-500" },
                  { title: "Duplicate Batch Header Fee", impact: "$15.00/mo", severity: "low", color: "text-blue-500" },
                  { title: "Inflated Assessment Fee", impact: "$32.40/mo", severity: "low", color: "text-blue-500" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-transparent hover:border-border hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <div className="space-y-1">
                      <p className="font-medium text-sm group-hover:text-primary transition-colors">{item.title}</p>
                      <Badge variant="outline" className={`text-xs ${item.severity === 'high' ? 'border-destructive/20 bg-destructive/5 text-destructive' : 'border-border text-muted-foreground'}`}>
                        {item.severity} severity
                      </Badge>
                    </div>
                    <div className={`font-mono font-medium text-sm ${item.color}`}>
                      {item.impact}
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href="/findings">View All Findings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
