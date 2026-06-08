import { ArrowRight, CheckCircle2, Settings2, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { SystemSettingsModule } from "@/components/modules/SystemSettingsModule";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const showOnboardingWelcome = location.state?.onboardingRedirect;

  return (
    <div className="space-y-6">
      {showOnboardingWelcome && (
        <Alert className="border-primary/30 bg-primary/5 dark:bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle className="font-semibold text-primary">Welcome to your new School Console!</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            You've been redirected here because your school setup is not yet complete. Please use the quick steps below to set up your profiles, academic terms, and classes so you can access the main dashboard.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary">School Setup</Badge>
                <Badge variant="outline">Onboarding</Badge>
              </div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Settings2 className="h-6 w-6 text-primary" /> School Setup & Settings
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Complete your school profile, configure terms, classes, streams, and manage system-wide configuration.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate("/communications")}>
              Open communication hub
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              "Configure school profile",
              "Set academic terms",
              "Manage system settings",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border bg-background/80 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SystemSettingsModule />
    </div>
  );
};

export default SettingsPage;
