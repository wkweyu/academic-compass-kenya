import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, LifeBuoy, Loader2, MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { communicationHubService, PlatformAnnouncement, SupportTicket, SupportTicketCategory, SupportTicketPriority } from "@/services/communicationHubService";
import { toast } from "sonner";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

type SupportTicketForm = {
  subject: string;
  description: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
};

const severityVariant = (severity: PlatformAnnouncement["severity"]): "default" | "destructive" | "secondary" | "outline" => {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "outline";
    case "success":
      return "secondary";
    default:
      return "default";
  }
};

export const SchoolCommunicationWidget = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupportTicketForm>({
    subject: "",
    description: "",
    category: "support",
    priority: "medium",
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ["platform-announcements", "active"],
    queryFn: communicationHubService.getActiveAnnouncements,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets", "school"],
    queryFn: () => communicationHubService.getSupportTickets("school"),
  });

  const createTicketMutation = useMutation({
    mutationFn: () => communicationHubService.createSupportTicket(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", "school"] });
      toast.success("Support ticket submitted");
      setForm({ subject: "", description: "", category: "support", priority: "medium" });
      setOpen(false);
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to submit support ticket")),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr,0.9fr]">
      <Card className="border-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-primary" /> System Alerts & Announcements
          </CardTitle>
          <CardDescription>
            Review platform notices, maintenance windows, and rollout updates affecting your school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {announcementsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active platform announcements right now.
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.slice(0, 4).map((announcement) => (
                <div key={announcement.id} className="rounded-xl border bg-card/60 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {announcement.delivery_channel.replace(/_/g, " ")} · {new Date(announcement.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={severityVariant(announcement.severity)}>{announcement.severity}</Badge>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{announcement.message}</p>
                  {announcement.link_url && (
                    <a href={announcement.link_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Open details <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LifeBuoy className="h-5 w-5 text-primary" /> Support Ticketing
              </CardTitle>
              <CardDescription>Raise support requests directly from the dashboard and track their status.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <MessageSquarePlus className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No support tickets submitted yet.
            </div>
          ) : (
            <ScrollArea className="h-[320px] pr-4">
              <div className="space-y-3">
                {tickets.slice(0, 6).map((ticket: SupportTicket) => (
                  <div key={ticket.id} className="rounded-xl border bg-card/60 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{ticket.subject}</h3>
                        <p className="text-xs text-muted-foreground">{ticket.category} · Updated {new Date(ticket.updated_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ticket.priority === "urgent" ? "destructive" : "outline"}>{ticket.priority}</Badge>
                        <Badge variant="secondary">{ticket.status.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{ticket.description}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit support request</DialogTitle>
            <DialogDescription>Send an issue directly to the platform team without leaving your dashboard.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Student billing report is not loading" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as SupportTicketCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">General support</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="bug">Bug report</SelectItem>
                    <SelectItem value="feature_request">Feature request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as SupportTicketPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={6} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Describe the issue, the page involved, and what the team should know..." />
            </div>
            <Button className="w-full" onClick={() => createTicketMutation.mutate()} disabled={createTicketMutation.isPending || !form.subject || !form.description}>
              {createTicketMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
