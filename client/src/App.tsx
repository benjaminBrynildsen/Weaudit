import { Switch, Route, useLocation } from "wouter";
import { useEffect, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Upload from "@/pages/Upload";
import History from "@/pages/History";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Review from "./pages/Review";
import Report from "@/pages/Report";
import Companies from "@/pages/Companies";
import { useAuth } from "@/hooks/useAuth";

function Protected({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [isLoading, user, setLocation]);

  // Avoid flashing protected content while we're still fetching /auth/me.
  if (isLoading || !user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Landing} />
      <Route path="/dashboard">
        <Protected><Dashboard /></Protected>
      </Route>
      <Route path="/upload">
        <Protected><Upload /></Protected>
      </Route>
      <Route path="/history">
        <Protected><History /></Protected>
      </Route>
      <Route path="/reports">
        <Protected><Reports /></Protected>
      </Route>
      <Route path="/report">
        <Protected><Report /></Protected>
      </Route>
      <Route path="/companies">
        <Protected><Companies /></Protected>
      </Route>
      <Route path="/review">
        <Protected><Review /></Protected>
      </Route>
      <Route path="/settings">
        <Protected><Settings /></Protected>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
