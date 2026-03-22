import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Loader2, MailPlus, MessageSquare, Send, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authService } from "@/services/authService";
import { schoolEngagementService } from "@/services/schoolEngagementService";
import { toast } from "sonner";

const DEFAULT_TEMPLATE_OPTIONS = [
  { key: "task_assigned", name: "Task assigned" },
  { key: "follow_up_due", name: "Follow-up due" },
  { key: "renewal_approaching", name: "Renewal approaching" },
  { key: "payment_failed", name: "Payment failed" },
  { key: "school_health_dropped", name: "School health dropped" },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIsoValue = (value: string) => (value ? new Date(value).toISOString() : undefined);

const CommunicationsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [communicationForm, setCommunicationForm] = useState({
    communication_type: "MEETING",
    direction: "OUTBOUND",
    subject: "",
    content: "",
    participants: "",
    follow_up_required: false,
    follow_up_due_at: "",
    follow_up_title: "",
  });
  const [notificationForm, setNotificationForm] = useState({
    template_key: "task_assigned",
    subject_override: "",
    body_override: "",
  });
  const [followUpForm, setFollowUpForm] = useState({
    title: "",
    description: "",
    due_at: "",
    follow_up_type: "CUSTOM",
    recurrence: "NONE",
  });

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ["current-user", "communications-page"],
    queryFn: () => authService.getCurrentUser(),
  });

  const schoolId = currentUser?.school?.id;

  const communicationsQuery = useQuery({
    queryKey: ["school-communications", schoolId, search],
    queryFn: () => schoolEngagementService.getCommunications(schoolId!, search || undefined),
    enabled: Boolean(schoolId),
  });

  const notificationsQuery = useQuery({
    queryKey: ["school-notifications", schoolId],
    queryFn: () => schoolEngagementService.getNotifications(schoolId!),
    enabled: Boolean(schoolId),
  });

  const followUpsQuery = useQuery({
    queryKey: ["school-follow-ups", schoolId],
    queryFn: () => schoolEngagementService.getFollowUps(schoolId!),
    enabled: Boolean(schoolId),
  });

  const todayFollowUpsQuery = useQuery({
    queryKey: ["school-follow-ups-today", schoolId],
    queryFn: () => schoolEngagementService.getTodayFollowUps(),
    enabled: Boolean(schoolId),
  });

  const previewQuery = useQuery({
    queryKey: ["school-notification-preview", notificationForm.template_key, schoolId],
    queryFn: () =>
      schoolEngagementService.previewNotification(notificationForm.template_key, {
        schoolName: currentUser?.school?.name || "Your school",
        taskName: "Follow-up task",
        followUpTitle: followUpForm.title || "Today follow-up",
      }),
    enabled: Boolean(notificationForm.template_key && schoolId),
  });

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["school-communications"] }),
      queryClient.invalidateQueries({ queryKey: ["school-notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["school-follow-ups"] }),
      queryClient.invalidateQueries({ queryKey: ["school-follow-ups-today"] }),
    ]);
  };

  const createCommunicationMutation = useMutation({
    mutationFn: () =>
      schoolEngagementService.createCommunication({
        school_id: schoolId!,
        communication_type: communicationForm.communication_type,
        direction: communicationForm.direction,
        subject: communicationForm.subject,
        content: communicationForm.content,
        participants: communicationForm.participants
          ? communicationForm.participants.split(",").map((name) => ({ name: name.trim() })).filter((item) => item.name)
          : [],
        follow_up_required: communicationForm.follow_up_required,
        follow_up_due_at: communicationForm.follow_up_required ? toIsoValue(communicationForm.follow_up_due_at) : undefined,
        follow_up_title: communicationForm.follow_up_title,
      }),
    onSuccess: async () => {
      toast.success("Communication logged");
      setCommunicationForm({
        communication_type: "MEETING",
        direction: "OUTBOUND",
        subject: "",
        content: "",
        participants: "",
        follow_up_required: false,
        follow_up_due_at: "",
        follow_up_title: "",
      });
      await refreshQueries();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to log communication")),
  });

  const sendNotificationMutation = useMutation({
    mutationFn: () =>
      schoolEngagementService.sendNotification({
        school_id: schoolId!,
        recipient_id: currentUser!.id,
        template_key: notificationForm.template_key,
        subject_override: notificationForm.subject_override,
        body_override: notificationForm.body_override,
        variables: {
          schoolName: currentUser?.school?.name || "Your school",
          taskName: "Follow-up task",
          followUpTitle: followUpForm.title || "Today follow-up",
        },
      }),
    onSuccess: async () => {
      toast.success("Notification created");
      await refreshQueries();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to send notification")),
  });

  const createFollowUpMutation = useMutation({
    mutationFn: () =>
      schoolEngagementService.createFollowUp({
        school_id: schoolId!,
        title: followUpForm.title,
        description: followUpForm.description,
        due_at: toIsoValue(followUpForm.due_at)!,
        follow_up_type: followUpForm.follow_up_type,
        recurrence: followUpForm.recurrence,
      }),
    onSuccess: async () => {
      toast.success("Follow-up created");
      setFollowUpForm({ title: "", description: "", due_at: "", follow_up_type: "CUSTOM", recurrence: "NONE" });
      await refreshQueries();
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Failed to create follow-up")),
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) => schoolEngagementService.snoozeFollowUp(id, days),
    onSuccess: async () => {
      toast.success("Follow-up snoozed");
      await refreshQueries();
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => schoolEngagementService.completeFollowUp(id, "Completed from communication hub"),
    onSuccess: async () => {
      toast.success("Follow-up completed");
      await refreshQueries();
    },
  });

  const summary = useMemo(() => ({
    communications: communicationsQuery.data?.length || 0,
    notifications: notificationsQuery.data?.length || 0,
    dueToday: todayFollowUpsQuery.data?.length || 0,
    openFollowUps: (followUpsQuery.data || []).filter((item) => item.status !== "COMPLETE").length,
  }), [communicationsQuery.data, notificationsQuery.data, todayFollowUpsQuery.data, followUpsQuery.data]);

  if (userLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!schoolId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Communication hub</CardTitle>
          <CardDescription>This view is for school-linked users. Platform users should use the SaaS dashboard.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MessageSquare className="h-6 w-6 text-primary" /> Communication hub
          </CardTitle>
          <CardDescription>
            View onboarding communications, notifications, and follow-ups in one place for {currentUser?.school?.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.communications}</div><p className="text-sm text-muted-foreground">Communication records</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.notifications}</div><p className="text-sm text-muted-foreground">Notifications</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.dueToday}</div><p className="text-sm text-muted-foreground">Due today</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.openFollowUps}</div><p className="text-sm text-muted-foreground">Open follow-ups</p></CardContent></Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Log communication</CardTitle>
                <CardDescription>Capture meetings, calls, internal notes, and optional follow-up tasks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={communicationForm.communication_type} onValueChange={(value) => setCommunicationForm((prev) => ({ ...prev, communication_type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="CALL">Call</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="NOTE">Note</SelectItem>
                        <SelectItem value="TASK">Task</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select value={communicationForm.direction} onValueChange={(value) => setCommunicationForm((prev) => ({ ...prev, direction: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OUTBOUND">Outbound</SelectItem>
                        <SelectItem value="INBOUND">Inbound</SelectItem>
                        <SelectItem value="INTERNAL">Internal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input value={communicationForm.subject} onChange={(e) => setCommunicationForm((prev) => ({ ...prev, subject: e.target.value }))} placeholder="Kickoff meeting" />
                </div>
                <div className="space-y-2">
                  <Label>Participants</Label>
                  <Input value={communicationForm.participants} onChange={(e) => setCommunicationForm((prev) => ({ ...prev, participants: e.target.value }))} placeholder="Principal, Bursar, ICT teacher" />
                </div>
                <div className="space-y-2">
                  <Label>Details</Label>
                  <Textarea rows={5} value={communicationForm.content} onChange={(e) => setCommunicationForm((prev) => ({ ...prev, content: e.target.value }))} placeholder="Summarize what happened and what comes next..." />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Follow-up needed?</Label>
                    <Select value={communicationForm.follow_up_required ? "yes" : "no"} onValueChange={(value) => setCommunicationForm((prev) => ({ ...prev, follow_up_required: value === "yes" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {communicationForm.follow_up_required && (
                    <div className="space-y-2">
                      <Label>Follow-up due</Label>
                      <Input type="datetime-local" value={communicationForm.follow_up_due_at} onChange={(e) => setCommunicationForm((prev) => ({ ...prev, follow_up_due_at: e.target.value }))} />
                    </div>
                  )}
                </div>
                {communicationForm.follow_up_required && (
                  <div className="space-y-2">
                    <Label>Follow-up title</Label>
                    <Input value={communicationForm.follow_up_title} onChange={(e) => setCommunicationForm((prev) => ({ ...prev, follow_up_title: e.target.value }))} placeholder="Send meeting recap" />
                  </div>
                )}
                <Button onClick={() => createCommunicationMutation.mutate()} disabled={createCommunicationMutation.isPending || !communicationForm.content.trim()}>
                  {createCommunicationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}Log communication
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Communication history</CardTitle>
                <CardDescription>Search the school timeline by subject or content.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search communication history" />
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {communicationsQuery.isLoading ? (
                        <TableRow><TableCell colSpan={3}><div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div></TableCell></TableRow>
                      ) : (communicationsQuery.data || []).length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No communication records yet.</TableCell></TableRow>
                      ) : (
                        communicationsQuery.data?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{new Date(item.occurred_at).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline">{item.communication_type}</Badge></TableCell>
                            <TableCell>
                              <div className="font-medium">{item.subject || "No subject"}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{item.content}</div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Send test notification</CardTitle>
                <CardDescription>Create visible notification records directly from the app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={notificationForm.template_key} onValueChange={(value) => setNotificationForm((prev) => ({ ...prev, template_key: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_TEMPLATE_OPTIONS.map((template) => (
                        <SelectItem key={template.key} value={template.key}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject override</Label>
                  <Input value={notificationForm.subject_override} onChange={(e) => setNotificationForm((prev) => ({ ...prev, subject_override: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>Body override</Label>
                  <Textarea rows={4} value={notificationForm.body_override} onChange={(e) => setNotificationForm((prev) => ({ ...prev, body_override: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="font-medium">Preview</div>
                  {previewQuery.isLoading ? (
                    <div className="mt-2 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading preview...</div>
                  ) : previewQuery.data ? (
                    <div className="mt-2 space-y-2">
                      <p><span className="font-medium">Subject:</span> {previewQuery.data.subject}</p>
                      <p className="text-muted-foreground">{previewQuery.data.body}</p>
                    </div>
                  ) : null}
                </div>
                <Button onClick={() => sendNotificationMutation.mutate()} disabled={sendNotificationMutation.isPending || !notificationForm.template_key}>
                  {sendNotificationMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Create notification record
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification records</CardTitle>
                <CardDescription>Recent in-app, email, and SMS notification records generated by the system.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notificationsQuery.isLoading ? (
                        <TableRow><TableCell colSpan={4}><div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div></TableCell></TableRow>
                      ) : (notificationsQuery.data || []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No notifications found.</TableCell></TableRow>
                      ) : (
                        notificationsQuery.data?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell><Badge variant="outline">{item.channel}</Badge></TableCell>
                            <TableCell>
                              <div className="font-medium">{item.subject || item.template_key}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{item.body}</div>
                            </TableCell>
                            <TableCell><Badge variant={item.status === "FAILED" ? "destructive" : item.status === "SENT" ? "secondary" : "outline"}>{item.status}</Badge></TableCell>
                            <TableCell className="text-xs">{new Date(item.created_at).toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="followups" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Create follow-up</CardTitle>
                <CardDescription>Manual follow-ups are now visible from a dedicated app page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={followUpForm.title} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Weekly check-in" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea rows={4} value={followUpForm.description} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Due at</Label>
                    <Input type="datetime-local" value={followUpForm.due_at} onChange={(e) => setFollowUpForm((prev) => ({ ...prev, due_at: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={followUpForm.follow_up_type} onValueChange={(value) => setFollowUpForm((prev) => ({ ...prev, follow_up_type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                        <SelectItem value="QUICK_CALL">Quick call</SelectItem>
                        <SelectItem value="DATA_REVIEW">Data review</SelectItem>
                        <SelectItem value="RENEWAL">Renewal</SelectItem>
                        <SelectItem value="BUSINESS_REVIEW">Business review</SelectItem>
                        <SelectItem value="REENGAGEMENT">Re-engagement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Recurrence</Label>
                  <Select value={followUpForm.recurrence} onValueChange={(value) => setFollowUpForm((prev) => ({ ...prev, recurrence: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => createFollowUpMutation.mutate()} disabled={createFollowUpMutation.isPending || !followUpForm.title || !followUpForm.due_at}>
                  {createFollowUpMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}Create follow-up
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Follow-up tracker</CardTitle>
                    <CardDescription>Manage due items, snooze them, or mark them complete.</CardDescription>
                  </div>
                  {(todayFollowUpsQuery.data?.length || 0) > 0 && <Badge>{todayFollowUpsQuery.data?.length} due today</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followUpsQuery.isLoading ? (
                        <TableRow><TableCell colSpan={4}><div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div></TableCell></TableRow>
                      ) : (followUpsQuery.data || []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No follow-ups found.</TableCell></TableRow>
                      ) : (
                        followUpsQuery.data?.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{item.description}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.status === "OVERDUE" ? "destructive" : item.status === "COMPLETE" ? "secondary" : "outline"}>{item.status}</Badge>
                              {item.escalated_at && <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600"><ShieldAlert className="h-3 w-3" />Escalated</div>}
                            </TableCell>
                            <TableCell className="text-xs">{new Date(item.due_at).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {item.status !== "COMPLETE" && (
                                  <Button size="sm" variant="outline" onClick={() => snoozeMutation.mutate({ id: item.id, days: 3 })} disabled={snoozeMutation.isPending}>Snooze 3d</Button>
                                )}
                                {item.status !== "COMPLETE" && (
                                  <Button size="sm" onClick={() => completeMutation.mutate(item.id)} disabled={completeMutation.isPending}>Complete</Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunicationsPage;
