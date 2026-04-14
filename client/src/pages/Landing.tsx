import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // If an already-signed-in user hits the landing page, bounce them to
  // the dashboard. Wait for the initial /auth/me fetch before deciding.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // The server redirects failed logins to /login?error=<message>. We use
  // the Landing page as /login too (see App.tsx routing).
  const errorMessage = new URLSearchParams(window.location.search).get("error");

  const handleGoogleSignIn = () => {
    // Full-page nav — OAuth flow requires leaving the SPA anyway.
    window.location.href = "/auth/google";
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="lg:w-1/2 bg-sidebar p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden text-sidebar-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sidebar-primary/20 via-transparent to-transparent opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-sidebar to-transparent" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 font-heading font-bold text-2xl tracking-tight mb-20">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span>AutoAudit</span>
          </div>

          <h1 className="font-heading text-4xl lg:text-6xl font-bold leading-tight mb-6">
            Stop Overpaying for <br />
            <span className="text-sidebar-primary">Credit Processing</span>
          </h1>
          <p className="text-lg text-sidebar-foreground/80 max-w-md leading-relaxed">
            Our intelligent auditing engine analyzes your statements, flags hidden fees, and helps you recover revenue in seconds.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-8 mt-12">
          <div className="border-l-2 border-sidebar-primary/50 pl-4">
            <p className="text-2xl font-bold font-heading">$4.2M+</p>
            <p className="text-sm text-sidebar-foreground/60">Recovered for clients</p>
          </div>
          <div className="border-l-2 border-sidebar-primary/50 pl-4">
            <p className="text-2xl font-bold font-heading">12k+</p>
            <p className="text-sm text-sidebar-foreground/60">Statements audited</p>
          </div>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold font-heading tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">
              Sign in with your Weaudit Google account to access your workspace.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span data-testid="text-login-error">{errorMessage}</span>
            </div>
          )}

          <Button
            data-testid="button-signin-google"
            type="button"
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full h-11 text-base gap-3 bg-white text-gray-900 hover:bg-gray-50 border-gray-200"
          >
            <GoogleIcon className="w-5 h-5" />
            Sign in with Google
          </Button>

          <div className="text-center text-sm text-muted-foreground pt-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="w-4 h-4" />
              <span data-testid="text-security-note">Bank-grade security & encryption</span>
            </div>
            <span>Don't have access? </span>
            <a data-testid="link-request-access" href="mailto:support@weaudit.com" className="font-medium text-primary hover:underline">
              Contact your admin
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  // Official Google "G" mark — viewbox 0 0 48 48.
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}
