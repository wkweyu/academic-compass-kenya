import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, Loader2, Mail, MessageSquare, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { communicationHubService, PlatformAnnouncement, SupportStaffMember, SupportTicket, SupportTicketMessage } from "@/services/communicationHubService";
import { SaasCommunication, SaaSSchool, saasService } from "@/services/saasService";
import { toast } from "sonner";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const formatAnnouncementStatus = (status: string) =>
  status
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const formatAnnouncementScope = (scope: string) =>
  scope
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const formatCommunicationStatus = (status?: string | null) => {
  switch ((status || "").toLowerCase()) {
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return status || "Unknown";
  }
};

const communicationBadgeVariant = (status?: string | null): "default" | "destructive" | "secondary" | "outline" => {
  switch ((status || "").toLowerCase()) {
    case "sent":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

const summarizeCommunicationContent = (content?: string | null) => {
  if (!content) return "—";
  const compact = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
};

const CommunicationDetailDialog = ({
  communication,
  schoolName,
  open,
  onOpenChange,
}: {
  communication: SaasCommunication | null;
  schoolName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  if (!communication) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-primary" /> Notification Log Details
          </DialogTitle>
          <DialogDescription>Inspect the stored payload and delivery state.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">School</p>
              <p className="font-medium text-foreground">{schoolName || "Platform-wide"}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Recipient</p>
              <p className="font-medium text-foreground break-all">{communication.recipient_email || "—"}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={communicationBadgeVariant(communication.status)} className="mt-1">
                {formatCommunicationStatus(communication.status)}
              </Badge>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium text-foreground">{communication.category}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="mt-1 font-medium text-foreground">{communication.subject || "No subject"}</p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Stored content</p>
            <ScrollArea className="mt-2 max-h-60 rounded border bg-muted/10 p-3">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
                {communication.content || "No content stored"}
              </pre>
            </ScrollArea>
          </div>

          {communication.error_message && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-xs text-destructive">Error message</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-destructive">
                {communication.error_message}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TicketThreadDialog = ({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [internalOnly, setInternalOnly] = useState(false);
  const [status, setStatus] = useState(ticket?.status || "open");
  const [assignee, setAssignee] = useState(ticket?.assigned_to || "unassigned");
  const [resolutionNotes, setResolutionNotes] = useState(ticket?.resolution_notes || "");

  useEffect(() => {
    setStatus(ticket?.status || "open");
    setAssignee(ticket?.assigned_to || "unassigned");
    setResolutionNotes(ticket?.resolution_notes || "");
  }, [ticket]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["support-ticket-messages", ticket?.id],
    queryFn: () => communicationHubService.getSupportTicketMessages(ticket!.id),
    enabled: open && !!ticket,
  });

  const { data: supportStaff = [] } = useQuery({
    queryKey: ["support-staff"],
    queryFn: communicationHubService.listSupportStaff,
    enabled: open,
  });

  const updateTicketMutation = useMutation({
    mutationFn: (nextStatus: string) => communicationHubService.updateSupportTicketStatus(ticket!.id, nextStatus as SupportTicket["status"]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", "platform"] });
      toast.success("Ticket status updated");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to update ticket")),
  });

  const assignTicketMutation = useMutation({
    mutationFn: () => communicationHubService.assignSupportTicket(ticket!.id, assignee, resolutionNotes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", "platform"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", ticket?.id] });
      toast.success("Ticket assigned");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to assign ticket")),
  });

  const resolveTicketMutation = useMutation({
    mutationFn: (closeTicket: boolean) => communicationHubService.resolveSupportTicket(ticket!.id, resolutionNotes, closeTicket),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets", "platform"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", ticket?.id] });
      toast.success("Ticket resolution saved");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to resolve ticket")),
  });

  const replyMutation = useMutation({
    mutationFn: () => communicationHubService.addSupportTicketMessage(ticket!.id, reply, internalOnly),
    onSuccess: () => {
      setReply("");
      setInternalOnly(false);
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", ticket?.id] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets", "platform"] });
      toast.success("Reply added");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to add reply")),
  });

  if (!ticket) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <DialogDescription>
            {ticket.school?.name || `School #${ticket.school_id}`} · {ticket.category} · {ticket.priority}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.8fr,1fr]">
          <div className="space-y-4">
            <ScrollArea className="h-[360px] rounded-lg border p-3">
              {isLoading ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`rounded-lg border p-3 ${message.is_internal ? "bg-amber-50/70 dark:bg-amber-950/20" : "bg-muted/20"}`}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{message.sender_role.replace("_", " ")}</Badge>
                          {message.is_internal && <Badge variant="outline">Internal note</Badge>}
                        </div>
                        <span>{new Date(message.created_at).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{message.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="space-y-3 rounded-lg border p-3">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the school or add an internal note..." rows={4} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={internalOnly} onChange={(e) => setInternalOnly(e.target.checked)} />
                Internal note only
              </label>
              <Button onClick={() => replyMutation.mutate()} disabled={!reply.trim() || replyMutation.isPending}>
                {replyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Add Reply
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{ticket.description}</p>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as SupportTicket["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_on_school">Waiting on School</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => updateTicketMutation.mutate(status)} disabled={updateTicketMutation.isPending}>
                {updateTicketMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Status
              </Button>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select support staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {supportStaff.map((member: SupportStaffMember) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name} · {member.primary_role || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => assignTicketMutation.mutate()}
                disabled={assignTicketMutation.isPending || assignee === "unassigned"}
              >
                {assignTicketMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Assign Ticket
              </Button>
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Resolution notes</Label>
              <Textarea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Document the fix, next steps, or any customer-facing resolution note..."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => resolveTicketMutation.mutate(false)}
                  disabled={resolveTicketMutation.isPending || !resolutionNotes.trim()}
                >
                  {resolveTicketMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Resolve Ticket
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => resolveTicketMutation.mutate(true)}
                  disabled={resolveTicketMutation.isPending || !resolutionNotes.trim()}
                >
                  Close Ticket
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AdminCommunicationHub = ({ schools }: { schools: SaaSSchool[] }) => {
  const queryClient = useQueryClient();
  const [selectedCommunication, setSelectedCommunication] = useState<SaasCommunication | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchLogs, setSearchLogs] = useState("");
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    message: "",
    target_scope: "all",
    audience: "all_users",
    delivery_channel: "dashboard",
    severity: "info",
    status: "draft",
    link_url: "",
    starts_at: "",
    expires_at: "",
    target_school_ids: [] as number[],
  });

  const schoolNameMap = useMemo(
    () => new Map(schools.map((school) => [school.id, school.name])),
    [schools],
  );

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ["platform-announcements"],
    queryFn: communicationHubService.getPlatformAnnouncements,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets", "platform"],
    queryFn: () => communicationHubService.getSupportTickets("platform"),
  });

  const { data: communications = [], isLoading: communicationsLoading } = useQuery({
    queryKey: ["saas-communications", "all"],
    queryFn: () => saasService.getCommunications(),
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: () =>
      communicationHubService.createAnnouncement({
        title: announcementForm.title,
        message: announcementForm.message,
        target_scope: announcementForm.target_scope as PlatformAnnouncement["target_scope"],
        target_school_ids: announcementForm.target_school_ids,
        audience: announcementForm.audience as PlatformAnnouncement["audience"],
        delivery_channel: announcementForm.delivery_channel as PlatformAnnouncement["delivery_channel"],
        severity: announcementForm.severity as PlatformAnnouncement["severity"],
        status: announcementForm.status as PlatformAnnouncement["status"],
        link_url: announcementForm.link_url || undefined,
        starts_at: announcementForm.starts_at ? new Date(announcementForm.starts_at).toISOString() : undefined,
        expires_at: announcementForm.expires_at ? new Date(announcementForm.expires_at).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      toast.success("Announcement saved");
      setAnnouncementForm({
        title: "",
        message: "",
        target_scope: "all",
        audience: "all_users",
        delivery_channel: "dashboard",
        severity: "info",
        status: "draft",
        link_url: "",
        starts_at: "",
        expires_at: "",
        target_school_ids: [],
      });
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to save announcement")),
  });

  const announcementActionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: PlatformAnnouncement["status"] }) => communicationHubService.updateAnnouncement(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-announcements"] });
      toast.success("Announcement updated");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to update announcement")),
  });

  const filteredCommunications = communications.filter((communication) => {
    const schoolName = communication.school_id ? schoolNameMap.get(communication.school_id) || "" : "";
    const haystack = `${schoolName} ${communication.recipient_email || ""} ${communication.subject || ""} ${communication.content || ""} ${communication.error_message || ""}`.toLowerCase();
    return haystack.includes(searchLogs.toLowerCase());
  });

  const toggleTargetSchool = (schoolId: number) => {
    setAnnouncementForm((prev) => ({
      ...prev,
      target_school_ids: prev.target_school_ids.includes(schoolId)
        ? prev.target_school_ids.filter((id) => id !== schoolId)
        : [...prev.target_school_ids, schoolId],
    }));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Communication Hub
        </CardTitle>
        <CardDescription className="text-xs">
          Broadcast announcements, display system alerts, manage support tickets, and verify notification delivery in one place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="broadcasts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="broadcasts">Broadcasts & Alerts</TabsTrigger>
            <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
            <TabsTrigger value="logs">Notification Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="broadcasts" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1.1fr,1fr]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">New Broadcast</CardTitle>
                  <CardDescription className="text-xs">Use this for announcements, dashboard alerts, and targeted messages.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={announcementForm.title} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Planned maintenance on Sunday" />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea rows={5} value={announcementForm.message} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, message: e.target.value }))} placeholder="Share the details schools should see in their dashboards..." />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Target scope</Label>
                      <Select value={announcementForm.target_scope} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, target_scope: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All schools</SelectItem>
                          <SelectItem value="active">Active schools</SelectItem>
                          <SelectItem value="trial">Trial schools</SelectItem>
                          <SelectItem value="inactive">Inactive schools</SelectItem>
                          <SelectItem value="specific_schools">Specific schools</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Audience</Label>
                      <Select value={announcementForm.audience} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, audience: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_users">All school users</SelectItem>
                          <SelectItem value="school_admins">School admins only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={announcementForm.delivery_channel} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, delivery_channel: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dashboard">Dashboard alert</SelectItem>
                          <SelectItem value="dashboard_and_email">Dashboard + email</SelectItem>
                          <SelectItem value="email">Email only</SelectItem>
                          <SelectItem value="sms">SMS only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select value={announcementForm.severity} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, severity: value }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Starts at</Label>
                      <Input type="datetime-local" value={announcementForm.starts_at} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, starts_at: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Expires at</Label>
                      <Input type="datetime-local" value={announcementForm.expires_at} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, expires_at: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Optional link URL</Label>
                    <Input value={announcementForm.link_url} onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, link_url: e.target.value }))} placeholder="https://status.example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Save as</Label>
                    <Select value={announcementForm.status} onValueChange={(value) => setAnnouncementForm((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Publish immediately</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {announcementForm.target_scope === "specific_schools" && (
                    <div className="space-y-2">
                      <Label>Target schools</Label>
                      <ScrollArea className="h-40 rounded-lg border p-3">
                        <div className="space-y-2">
                          {schools.map((school) => {
                            const selected = announcementForm.target_school_ids.includes(school.id);
                            return (
                              <button key={school.id} type="button" onClick={() => toggleTargetSchool(school.id)} className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-foreground"}`}>
                                <span className="truncate">{school.name}</span>
                                {selected && <Badge variant="outline">Selected</Badge>}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  <Button onClick={() => createAnnouncementMutation.mutate()} disabled={createAnnouncementMutation.isPending || !announcementForm.title || !announcementForm.message}>
                    {createAnnouncementMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Save Broadcast
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Announcement Queue</CardTitle>
                  <CardDescription className="text-xs">Draft, publish, and archive system-wide broadcasts.</CardDescription>
                </CardHeader>
                <CardContent>
                  {announcementsLoading ? (
                    <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : announcements.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">No announcements yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {announcements.map((announcement) => (
                        <div key={announcement.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{announcement.title}</p>
                              <p className="text-xs text-muted-foreground">{formatAnnouncementScope(announcement.target_scope)} · {announcement.delivery_channel.replace(/_/g, " ")}</p>
                            </div>
                            <Badge variant={announcement.status === "published" ? "secondary" : "outline"}>{formatAnnouncementStatus(announcement.status)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{announcement.message}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {announcement.status !== "published" && (
                              <Button size="sm" variant="outline" onClick={() => announcementActionMutation.mutate({ id: announcement.id, status: "published" })}>Publish</Button>
                            )}
                            {announcement.status !== "archived" && (
                              <Button size="sm" variant="ghost" onClick={() => announcementActionMutation.mutate({ id: announcement.id, status: "archived" })}>Archive</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Support Ticketing System</CardTitle>
                <CardDescription className="text-xs">Review tickets submitted by schools and respond from the platform console.</CardDescription>
              </CardHeader>
              <CardContent>
                {ticketsLoading ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : tickets.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No support tickets yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>School</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id} className="text-xs">
                          <TableCell className="font-medium text-foreground">{ticket.school?.name || `School #${ticket.school_id}`}</TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{ticket.subject}</div>
                            <div className="text-[11px] text-muted-foreground">{ticket.category}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ticket.priority === "urgent" ? "destructive" : "outline"}>{ticket.priority}</Badge>
                          </TableCell>
                          <TableCell><Badge variant="outline">{ticket.status.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell>{new Date(ticket.updated_at).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTicket(ticket)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <TicketThreadDialog ticket={selectedTicket} open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }} />
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center gap-3">
              <Input value={searchLogs} onChange={(e) => setSearchLogs(e.target.value)} placeholder="Search school, recipient, subject, or error..." />
              <Badge variant="outline">{filteredCommunications.length} log entries</Badge>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notification Delivery Logs</CardTitle>
                <CardDescription className="text-xs">Verify emails and system notifications sent across the SaaS platform.</CardDescription>
              </CardHeader>
              <CardContent>
                {communicationsLoading ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : filteredCommunications.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">No notification logs found.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCommunications.map((communication) => (
                        <TableRow key={communication.id} className="text-xs">
                          <TableCell>{new Date(communication.created_at).toLocaleString()}</TableCell>
                          <TableCell>{communication.school_id ? schoolNameMap.get(communication.school_id) || `School #${communication.school_id}` : "Platform-wide"}</TableCell>
                          <TableCell>{communication.recipient_email || "—"}</TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{communication.subject || "No subject"}</div>
                            <div className="text-[11px] text-muted-foreground">{summarizeCommunicationContent(communication.content)}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={communicationBadgeVariant(communication.status)}>{formatCommunicationStatus(communication.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCommunication(communication)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CommunicationDetailDialog
        communication={selectedCommunication}
        schoolName={selectedCommunication?.school_id ? schoolNameMap.get(selectedCommunication.school_id) : "Platform-wide"}
        open={!!selectedCommunication}
        onOpenChange={(open) => {
          if (!open) setSelectedCommunication(null);
        }}
      />
    </Card>
  );
};
