import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useAuth, useLogout } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  Files,
  AlertTriangle,
  Building2,
  CalendarClock,
  BarChart3,
  PlayCircle,
  Settings,
  LogOut,
  Menu,
  ShieldCheck,
  Search,
  Bell,
  PanelLeftOpen,
  PanelLeftClose,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed?: boolean;
}

function Sidebar({ collapsed }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/login"),
    });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "—";

  const navItems = [
    { icon: LayoutDashboard, label: "Statements", href: "/dashboard" },
    { icon: Files, label: "Bulk Audit", href: "/bulk-audit" },
    { icon: CalendarClock, label: "History", href: "/history" },
    { icon: Building2, label: "Companies", href: "/companies" },
    { icon: BarChart3, label: "Reports", href: "/reports" },
    { icon: PlayCircle, label: "Demos", href: "/demos" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: AlertTriangle, label: "Admin Database", href: "/review" },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className={collapsed ? "p-4 flex justify-center" : "p-6"}>
        <div className="flex items-center gap-2 font-heading font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <ShieldCheck className="w-5 h-5" />
          </div>
          {!collapsed && <span>We Audit</span>}
        </div>
      </div>

      <div className={`flex-1 ${collapsed ? "px-2" : "px-3"} py-4 space-y-1`}>
        {navItems.map((item) =>
          collapsed ? (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  data-testid={`link-nav-${item.href.replace("/", "") || "home"}`}
                  className={`flex items-center justify-center p-2.5 rounded-md text-sm font-medium transition-colors ${
                    location === item.href
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          ) : (
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
              <span>{item.label}</span>
            </Link>
          )
        )}
      </div>

      <div className={`${collapsed ? "p-2" : "p-4"} mt-auto border-t border-sidebar-border`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-account-menu"
              className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} w-full p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-left`}
            >
              <Avatar className="w-8 h-8 border border-sidebar-border">
                {user?.picture && <AvatarImage src={user.picture} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name ?? "Not signed in"}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email ?? ""}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.email ?? "My Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="button-account-logout"
              className="text-destructive"
              onSelect={handleLogout}
              disabled={logout.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logout.isPending ? "Signing out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auto-collapse sidebar below xl (1280px), fully hide below md (768px)
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1280 : false
  );
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    if (manualOverride) return;
    const mq = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => setCollapsed(!e.matches);
    setCollapsed(!mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [manualOverride]);

  const toggleCollapse = () => {
    setManualOverride(true);
    setCollapsed((c) => !c);
  };

  const sidebarWidth = collapsed ? "w-16" : "w-64";
  const contentMargin = collapsed ? "md:ml-16" : "md:ml-64";

  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-background">
        <aside className={`hidden md:block ${sidebarWidth} fixed inset-y-0 z-50 transition-all duration-200 ease-in-out`}>
          <Sidebar collapsed={collapsed} />
        </aside>

        <div className={`flex-1 ${contentMargin} flex flex-col min-h-screen transition-all duration-200 ease-in-out`}>
          <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border h-16 flex items-center px-4 sm:px-6 justify-between">
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

              <Button
                data-testid="button-toggle-sidebar"
                variant="ghost"
                size="icon"
                className="hidden md:flex text-muted-foreground hover:text-foreground"
                onClick={toggleCollapse}
              >
                {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </Button>

              <div className="relative hidden sm:block sm:w-64 lg:w-96">
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

          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
