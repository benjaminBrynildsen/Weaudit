import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, TimerReset, KeyRound, PlugZap } from "lucide-react";

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 data-testid="text-settings-title" className="text-3xl font-bold font-heading tracking-tight">
            Settings
          </h1>
          <p data-testid="text-settings-subtitle" className="text-muted-foreground mt-1">
            Retention, MFA, and integration placeholders.
          </p>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p data-testid="text-settings-rulepacks-title" className="text-sm font-semibold text-amber-800">
                  Rule packs live under Review
                </p>
                <p data-testid="text-settings-rulepacks-body" className="text-sm text-amber-800/80 mt-1">
                  Go to the “Admin Database” item in the left sidebar to manage Processor ISOs and the Downgrade list.
                </p>
                <div className="mt-3">
                  <Button
                    data-testid="button-open-rulepacks"
                    size="sm"
                    className="h-8 bg-amber-700 hover:bg-amber-800 text-white"
                    onClick={() => {
                      window.location.href = "/review";
                    }}
                  >
                    Open Rule Packs
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <TimerReset className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold" data-testid="text-retention-title">
                  Data retention
                </p>
                <p className="text-xs text-muted-foreground">Default 90 days with immediate delete option.</p>
              </div>
            </div>
            <Badge data-testid="badge-retention" variant="outline" className="text-muted-foreground">
              90 days
            </Badge>
          </div>

          <Separator className="my-4" />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default retention (days)</Label>
              <Input data-testid="input-retention-days" defaultValue="90" />
            </div>
            <div className="space-y-2">
              <Label>Immediate deletion</Label>
              <div className="flex items-center gap-3 h-10">
                <Button data-testid="button-delete-now" variant="outline" size="sm">
                  Delete now
                </Button>
                <span className="text-xs text-muted-foreground">Removes source artifacts + processed data.</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold" data-testid="text-mfa-title">
                  MFA
                </p>
                <p className="text-xs text-muted-foreground">Optional for MVP. Required for Admins in V2.</p>
              </div>
            </div>
            <Switch data-testid="switch-mfa" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <PlugZap className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold" data-testid="text-integrations-settings-title">
                  Integrations
                </p>
                <p className="text-xs text-muted-foreground">Placeholders for Doc Hub / Google / Zoho.</p>
              </div>
            </div>
            <Button data-testid="button-open-integrations" variant="outline" size="sm">
              Manage
            </Button>
          </div>

          <Separator className="my-4" />

          <div className="rounded-lg border border-border bg-secondary/10 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold" data-testid="text-integration-note-title">
                  Security note
                </p>
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-integration-note-body">
                  Real integrations should use secure connections and not expose API keys in the browser.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
