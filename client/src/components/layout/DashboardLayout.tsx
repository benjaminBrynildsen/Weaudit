import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  Search,
  Bell,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  collapsed?: boolean;
}

function Sidebar({ collapsed }: SidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Statements", href: "/dashboard" },
    { icon: AlertTriangle, label: "Findings", href: "/findings" },
    { icon: BarChart3, label: "Reports", href: "/reports" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: AlertTriangle, label: "Admin Database", href: "/review" },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-2 font-heading font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!collapsed && <span>AutoAudit</span>}
        </div>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-testid={`link-nav-${item.href.replace("/", "") || "home"}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              location === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </div>

      <div className="p-4 mt-auto border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-account-menu"
              className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-left"
            >
              <Avatar className="w-8 h-8 border border-sidebar-border">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Jane Doe</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">jane@example.com</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="button-account-profile">Profile</DropdownMenuItem>
            <DropdownMenuItem data-testid="button-account-team">Team</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="button-account-logout" className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:block w-64 fixed inset-y-0 z-50">
        <Sidebar />
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen transition-all duration-300 ease-in-out">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center px-6 justify-between">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  data-testid="button-mobile-menu"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r border-sidebar-border">
                <Sidebar />
              </SheetContent>
            </Sheet>

            <div className="relative hidden sm:block w-96">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-global-search"
                type="search"
                placeholder="Search statements, findings, or clients..."
                className="pl-9 bg-secondary/50 border-transparent focus:bg-background focus:border-input transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              data-testid="button-notifications"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">{children}</div>
        </main>
      </div>
    </div>
  );
}
