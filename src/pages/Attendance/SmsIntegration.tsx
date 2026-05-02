import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";

export function SmsIntegration() {
  return (
    <div className="space-y-6">
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <CardTitle>SMS Gateway Settings</CardTitle>
          </div>
          <CardDescription>
            Configure SMS notifications for attendance alerts to parents and guardians
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable SMS Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send automatic SMS alerts for absences and late arrivals
              </p>
            </div>
            <Switch />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="sms-provider">SMS Provider</Label>
              <Input id="sms-provider" placeholder="e.g., Twilio, Africa's Talking" />
            </div>

            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input id="api-key" type="password" placeholder="Enter API key" />
            </div>

            <div>
              <Label htmlFor="sender-id">Sender ID</Label>
              <Input id="sender-id" placeholder="SCHOOL NAME" />
            </div>

            <div>
              <Label htmlFor="message-template">Absence Alert Template</Label>
              <Textarea 
                id="message-template" 
                placeholder="Dear parent, {student_name} was absent on {date}. Please contact the school if this is an error."
                rows={4}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Test SMS
            </Button>
            <Button variant="outline">Save Configuration</Button>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">SMS Credits</h4>
            <p className="text-sm text-muted-foreground">
              Not configured. Please enter SMS gateway details.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent SMS Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No SMS logs available
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
