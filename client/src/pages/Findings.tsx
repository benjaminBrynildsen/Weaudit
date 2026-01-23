import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Search, Filter, ArrowUpDown, ChevronRight, FileText, ShieldAlert, CreditCard, Banknote, FileWarning, Landmark, Scale } from "lucide-react";
import { useState } from "react";

// Mock Data
const findings = [
  { id: 1, title: "PCI Non-Compliance Fee", category: "Compliance", impact: 129.00, severity: "high", status: "open", processor: "Stripe", date: "Jan 12, 2024" },
  { id: 2, title: "Excessive Authorization Fee", category: "Gateway", impact: 42.50, severity: "medium", status: "acknowledged", processor: "Square", date: "Jan 12, 2024" },
  { id: 3, title: "Duplicate Monthly Service Fee", category: "Junk Fees", impact: 15.00, severity: "low", status: "resolved", processor: "Chase", date: "Jan 12, 2024" },
  { id: 4, title: "Tiered Downgrade (Non-Qual)", category: "Pricing Model", impact: 450.00, severity: "high", status: "open", processor: "Stripe", date: "Jan 12, 2024" },
  { id: 5, title: "Statement Fee", category: "Junk Fees", impact: 9.95, severity: "low", status: "false_positive", processor: "Stripe", date: "Jan 12, 2024" },
  { id: 6, title: "Batch Header Fee", category: "Junk Fees", impact: 0.15, severity: "low", status: "open", processor: "Chase", date: "Jan 12, 2024" },
  { id: 7, title: "International Surcharge", category: "Processor Markup", impact: 85.20, severity: "medium", status: "open", processor: "Global", date: "Jan 12, 2024" },
  { id: 8, title: "Early Termination Risk", category: "Contract", impact: 0.00, severity: "medium", status: "open", processor: "Global", date: "Jan 12, 2024" },
];

const categories = [
  { id: "all", label: "All Findings", icon: FileText },
  { id: "Pricing Model", label: "Pricing Model", icon: Scale },
  { id: "Processor Markup", label: "Processor Markup", icon: Banknote },
  { id: "Junk Fees", label: "Junk / Hidden", icon: FileWarning },
  { id: "Compliance", label: "PCI & Compliance", icon: ShieldAlert },
  { id: "Gateway", label: "Gateway", icon: CreditCard },
  { id: "Contract", label: "Contract Risk", icon: Landmark },
];

export default function Findings() {
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  const filteredFindings = activeTab === "all" 
    ? findings 
    : findings.filter(f => f.category === activeTab || (activeTab === "Junk Fees" && f.category === "Junk Fees"));

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold font-heading tracking-tight">Findings & Audit</h1>
            <p className="text-muted-foreground mt-1">Review flagged overcharges and anomalies detected in your statements.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Categories Tabs */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-transparent gap-1 border-b border-border rounded-none mb-6 no-scrollbar">
            {categories.map((cat) => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id}
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-border border border-transparent px-4 py-2"
              >
                <cat.icon className="w-4 h-4 mr-2" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-card rounded-lg border border-border shadow-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search findings..." 
                  className="pl-9 border-border bg-background" 
                />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="high">High Impact</SelectItem>
                  <SelectItem value="medium">Medium Impact</SelectItem>
                  <SelectItem value="low">Low Impact</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all_status">
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_status">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead className="w-[300px]">Finding</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1 cursor-pointer hover:text-foreground">
                        Impact <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFindings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No findings in this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredFindings.map((finding) => (
                      <TableRow key={finding.id} className="group cursor-pointer hover:bg-secondary/20" onClick={() => setSelectedFinding(finding)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            {finding.severity === 'high' ? (
                              <div className="p-1.5 rounded-full bg-destructive/10 text-destructive">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            ) : (
                              <div className="p-1.5 rounded-full bg-secondary text-muted-foreground">
                                <AlertTriangle className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-foreground">{finding.title}</div>
                              <div className="text-xs text-muted-foreground">{finding.processor} • {finding.date}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            {finding.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-foreground">
                          ${finding.impact.toFixed(2)}
                          <span className="text-xs text-muted-foreground font-sans ml-1">/mo</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`
                              ${finding.severity === 'high' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20' : ''}
                              ${finding.severity === 'medium' ? 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-orange-500/20' : ''}
                              ${finding.severity === 'low' ? 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20' : ''}
                            `} 
                            variant="outline"
                          >
                            {finding.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${finding.status === 'open' ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <span className="capitalize text-sm">{finding.status.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            Review <ChevronRight className="ml-1 w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Detail Slide-over (Simulated with Sheet) */}
      <Sheet open={!!selectedFinding} onOpenChange={() => setSelectedFinding(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {selectedFinding && (
            <div className="space-y-8 pt-6">
              <div className="space-y-2">
                <Badge 
                  className={`
                    ${selectedFinding.severity === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''}
                    ${selectedFinding.severity === 'medium' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : ''}
                    ${selectedFinding.severity === 'low' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : ''}
                  `} 
                  variant="outline"
                >
                  {selectedFinding.severity.toUpperCase()} SEVERITY
                </Badge>
                <h2 className="text-2xl font-bold font-heading">{selectedFinding.title}</h2>
                <p className="text-muted-foreground">
                  Detected in {selectedFinding.processor} statement from {selectedFinding.date}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1">Monthly Impact</div>
                  <div className="text-2xl font-bold font-mono text-destructive">-${selectedFinding.impact.toFixed(2)}</div>
                </div>
                <div className="p-4 rounded-lg bg-card border border-border shadow-sm">
                  <div className="text-sm text-muted-foreground mb-1">Annualized</div>
                  <div className="text-2xl font-bold font-mono text-foreground">-${(selectedFinding.impact * 12).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Why it matters</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  This fee is typically charged when a merchant does not validate PCI compliance annually. Many processors charge a monthly non-compliance fee ranging from $30 to $150 until validation is provided.
                </p>
                
                <div className="bg-secondary/30 p-4 rounded-lg border border-border">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Evidence from Statement
                  </h4>
                  <div className="font-mono text-xs bg-background p-3 rounded border border-border text-muted-foreground">
                    Page 3 • Line 42
                    <br />
                    <span className="text-foreground">PCI NON-COMPLIANCE FEE ............ $129.00</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="font-semibold text-lg">Recommended Action</h3>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                  <p className="text-sm text-muted-foreground pt-1">Log in to the {selectedFinding.processor} portal and locate the PCI Compliance section.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                  <p className="text-sm text-muted-foreground pt-1">Complete the Self-Assessment Questionnaire (SAQ).</p>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                  <p className="text-sm text-muted-foreground pt-1">Request a retroactive refund for the past 3 months of non-compliance fees.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <Button className="flex-1">Mark as Resolved</Button>
                <Button variant="outline" className="flex-1">Dispute with Processor</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
