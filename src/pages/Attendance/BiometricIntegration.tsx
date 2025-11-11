import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Fingerprint, Settings } from "lucide-react";

export function BiometricIntegration() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader title="Biometric Integration" />
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-6 w-6 text-primary" />
            <CardTitle>Biometric Device Settings</CardTitle>
          </div>
          <CardDescription>
            Configure biometric attendance devices for automated attendance marking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Biometric Integration</Label>
              <p className="text-sm text-muted-foreground">
                Allow biometric devices to mark attendance automatically
              </p>
            </div>
            <Switch />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="device-ip">Device IP Address</Label>
              <Input id="device-ip" placeholder="192.168.1.100" />
            </div>

            <div>
              <Label htmlFor="device-port">Device Port</Label>
              <Input id="device-port" placeholder="4370" />
            </div>

            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" type="password" placeholder="Enter device API key" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Test Connection
            </Button>
            <Button variant="outline">Save Configuration</Button>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Connection Status</h4>
            <p className="text-sm text-muted-foreground">
              Not configured. Please enter device details and test connection.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Biometric Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No biometric logs available
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
