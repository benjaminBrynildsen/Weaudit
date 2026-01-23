import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { useState } from "react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate login delay
    setTimeout(() => {
      setLocation("/dashboard");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left Side - Hero/Brand */}
      <div className="lg:w-1/2 bg-sidebar p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden text-sidebar-foreground">
        {/* Background Texture/Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-sidebar-primary/20 via-transparent to-transparent opacity-50"></div>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-sidebar to-transparent"></div>
        
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

      {/* Right Side - Login Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold font-heading tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">Enter your credentials to access your workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="name@company.com" required className="h-11" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">Forgot password?</a>
              </div>
              <Input id="password" type="password" required className="h-11" />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="remember" />
              <label
                htmlFor="remember"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember me for 30 days
              </label>
            </div>

            <Button type="submit" className="w-full h-11 text-base group" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground pt-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="w-4 h-4" />
              <span>Bank-grade security & encryption</span>
            </div>
            Don't have an account? <a href="#" className="font-medium text-primary hover:underline">Request access</a>
          </div>
        </div>
      </div>
    </div>
  );
}
