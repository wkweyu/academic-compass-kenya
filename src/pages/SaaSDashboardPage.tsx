import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlatformAccessProfile, PlatformManagedUser, PlatformStaffMember, SaasCommunication, SaasTierFeature, saasService, SaaSSchool } from "@/services/saasService";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, Users, GraduationCap, Plus, Power, PowerOff,
  Shield, LogOut, Clock, CheckCircle, Search, Mail, Loader2,
  Pencil, Send, Eye, X, ChevronDown, Activity, BarChart3,
  Globe, Phone, MapPin, CalendarDays, TrendingUp, CreditCard,
  FileText, History, MessageSquare, AlertTriangle, ExternalLink,
  Trash2, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminCommunicationHub } from "@/components/communication/AdminCommunicationHub";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Owner",
  support: "Support User",
  marketer: "Marketer (Account Manager)",
};

const formatSchoolName = (name: string) => {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
};

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
    case "pending":
      return "outline";
    default:
      return "outline";
  }
};

const formatCommunicationCategory = (category?: string | null) => {
  if (!category) return "General";
  return category
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
};

const summarizeCommunicationContent = (content?: string | null) => {
  if (!content) return "—";
  const compact = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) return "—";
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact;
};

const ACCESS_RULES: Record<string, { allowed: string[]; blocked: string[] }> = {
  platform_admin: {
    allowed: [
      "View all schools and audit logs",
      "Onboard schools and assign portfolios",
      "Change subscriptions and activation status",
      "Repair and resend school admin access",
    ],
    blocked: [],
  },
  support: {
    allowed: [
      "View all schools and audit logs",
      "Edit school contact details",
      "Repair and resend school admin access",
    ],
    blocked: [
      "Cannot onboard schools",
      "Cannot change plans or school activation status",
      "Cannot assign or reassign portfolios",
    ],
  },
  account_manager: {
    allowed: [
      "View only assigned portfolio schools",
      "Onboard schools into own portfolio",
      "Edit school details and resend school admin access",
    ],
    blocked: [
      "Cannot view other portfolios",
      "Cannot change plans or school activation status",
      "Cannot reassign portfolios",
    ],
  },
  marketer: {
    allowed: [
      "View only assigned portfolio schools",
      "Onboard schools into own portfolio",
      "Edit school details and resend school admin access",
    ],
    blocked: [
      "Cannot view other portfolios",
      "Cannot change plans or school activation status",
      "Cannot reassign portfolios",
    ],
  },
};

const getRoleLabel = (role?: string | null) => ROLE_LABELS[role || ""] || "Console User";

/* ─────────── Platform Staff Management ─────────── */
const StaffManagementTab = ({
  users,
  isLoading,
  canManagePortfolios,
  onCreateUser,
  onDeleteUser,
  creating,
  deletingUserId,
}: {
  users: PlatformManagedUser[];
  isLoading: boolean;
  canManagePortfolios: boolean;
  onCreateUser: (payload: { email: string; first_name: string; last_name: string; role: string; password: string }) => void;
  onDeleteUser: (userId: number) => void;
  creating: boolean;
  deletingUserId: number | null;
}) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "support",
    password: "",
  });

  if (!canManagePortfolios) return null;

  const handleCreate = () => {
    if (!form.email || !form.role) {
      toast.error("Email and role are required");
      return;
    }
    onCreateUser(form);
    setOpen(false);
    setForm({ email: "", first_name: "", last_name: "", role: "support", password: "" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCog className="w-4 h-4 text-muted-foreground" /> Platform Management
            </CardTitle>
            <CardDescription className="text-xs">Manage platform administrators and support staff</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> New User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Platform User</DialogTitle>
                <DialogDescription>Add a new user and assign a role.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="First Name" value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} />
                  <Input placeholder="Last Name" value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} />
                </div>
                <Select value={form.role} onValueChange={(v) => setForm((prev) => ({ ...prev, role: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_admin">Platform Owner (Super Admin)</SelectItem>
                    <SelectItem value="support">Support User</SelectItem>
                    <SelectItem value="account_manager">Account Manager</SelectItem>
                    <SelectItem value="marketer">Marketer (Account Manager)</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Temporary Password (optional)" type="text" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating...</> : "Create User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No platform staff found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Primary Role</TableHead>
                <TableHead>Secondary Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.full_name || "No Name"}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {getRoleLabel(member.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">—</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Delete User"
                      onClick={() => onDeleteUser(member.id)}
                      disabled={deletingUserId === member.id}
                    >
                      {deletingUserId === member.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
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
            <Mail className="w-4 h-4 text-primary" /> Email Details
          </DialogTitle>
          <DialogDescription>
            Review the tracked email details and delivery outcome.
          </DialogDescription>
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
              <p className="font-medium text-foreground">{formatCommunicationCategory(communication.category)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium text-foreground">{new Date(communication.created_at).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Sent</p>
              <p className="font-medium text-foreground">{communication.sent_at ? new Date(communication.sent_at).toLocaleString() : "Not yet marked as sent"}</p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="mt-1 font-medium text-foreground">{communication.subject || "No subject"}</p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Tracked content</p>
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

/* ─────────── Subscription Management Tab ─────────── */
const SchoolSubscriptionView = ({ school, tiers = [] }: { school: SaaSSchool, tiers?: SaasTierFeature[] }) => {
  const currentTier = tiers.find(t => t.tier_name === school.subscription_plan);
  
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["saas-subscription-history", school.id],
    queryFn: () => saasService.getSubscriptionHistory(school.id),
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["saas-invoices", school.id],
    queryFn: () => saasService.getInvoices(school.id),
  });

  const queryClient = useQueryClient();
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [generatingInv, setGeneratingInv] = useState(false);
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [extendingPlan, setExtendingPlan] = useState(false);
  const [sendingNotification, setSendingNotification] = useState<number | null>(null);
  const [recordingPayment, setRecordingPayment] = useState<number | null>(null);

  const handleSendNotification = async (invoiceId: number) => {
    setSendingNotification(invoiceId);
    try {
      await saasService.sendInvoiceNotification(invoiceId);
      toast.success("Notification sent successfully");
      queryClient.invalidateQueries({ queryKey: ["saas-invoices", school.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification");
    } finally {
      setSendingNotification(null);
    }
  };

  const handleRecordPayment = async (invoiceId: number) => {
    setRecordingPayment(invoiceId);
    try {
      await saasService.recordInvoicePayment({ invoiceId });
      toast.success("Payment recorded and subscription extended!");
      queryClient.invalidateQueries({ queryKey: ["saas-invoices", school.id] });
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setRecordingPayment(null);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!invoiceAmount || !invoiceDesc) return;
    setGeneratingInv(true);
    try {
      await saasService.generateInvoice({
        schoolId: school.id,
        amount: parseFloat(invoiceAmount),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        items: [{ description: invoiceDesc, amount: parseFloat(invoiceAmount) }]
      });
      toast.success("Invoice generated successfully");
      queryClient.invalidateQueries({ queryKey: ["saas-invoices", school.id] });
      setInvoiceAmount("");
      setInvoiceDesc("");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setGeneratingInv(false);
    }
  };

  const calcNewDate = (days: number) => {
    const base = school.subscription_end ? new Date(school.subscription_end) : new Date();
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return next.toISOString().split("T")[0];
  };

  const handleExtendTrial = async (days: number) => {
    setExtendingTrial(true);
    try {
      await saasService.extendTrial({ schoolId: school.id, newEndDate: calcNewDate(days), reason: `Trial extended by ${days} days` });
      toast.success(`Trial extended by ${days} days`);
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to extend trial");
    } finally {
      setExtendingTrial(false);
    }
  };

  const handleExtendPlan = async (days: number) => {
    setExtendingPlan(true);
    try {
      await saasService.extendSubscriptionPeriod({
        schoolId: school.id,
        newEndDate: calcNewDate(days),
        newStatus: school.subscription_status,
        reason: `Subscription extended by ${days} days`,
      });
      toast.success(`Subscription extended by ${days} days`);
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to extend subscription");
    } finally {
      setExtendingPlan(false);
    }
  };

  return (
    <div className="space-y-6">
      {currentTier && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold capitalize">{currentTier.tier_name} Tier Active</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4">Up to {currentTier.max_students} Students</Badge>
                  <Badge variant="outline" className="text-[10px] h-4">Up to {currentTier.max_users} Users</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-tighter">Annual Fee</p>
              <p className="font-mono font-bold">KES {currentTier.annual_fee.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {school.subscription_status?.includes("trial") && (
          <Button variant="outline" size="sm" onClick={() => handleExtendTrial(14)} disabled={extendingTrial}>
            {extendingTrial ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Extend Trial +14d
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => handleExtendPlan(30)} disabled={extendingPlan}>
          {extendingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Extend Plan +30d
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" /> Subscription History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !history || history.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-4">No history records found</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium capitalize">{h.plan_name}</p>
                      <p className="text-muted-foreground">{new Date(h.start_date).toLocaleDateString()} - {h.end_date ? new Date(h.end_date).toLocaleDateString() : 'Active'}</p>
                    </div>
                    <Badge variant={h.status === 'active' ? 'default' : 'secondary'} className="scale-90">
                      {h.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !invoices || invoices.length === 0 ? (
              <p className="text-xs text-center text-muted-foreground py-4">No invoices generated yet</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-0 group/inv">
                      <div>
                        <p className="font-medium">{inv.invoice_number}</p>
                        <p className="text-muted-foreground font-mono">KES {inv.amount.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'} className="scale-90">
                          {inv.status}
                        </Badge>
                        {inv.status !== 'paid' && (
                          <div className="flex gap-1">
                            {inv.status === 'draft' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover/inv:opacity-100 transition-opacity"
                                onClick={() => handleSendNotification(inv.id)}
                                title="Send Email Notification"
                                disabled={sendingNotification === inv.id}
                              >
                                {sendingNotification === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 text-blue-600" />}
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover/inv:opacity-100 transition-opacity"
                              onClick={() => handleRecordPayment(inv.id)}
                              title="Record Payment"
                              disabled={recordingPayment === inv.id}
                            >
                              {recordingPayment === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3 text-emerald-600" />}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Generate Manual Invoice</CardTitle>
          <CardDescription className="text-xs">Create a draft invoice for manual payment or adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
             <Input 
               placeholder="Amount" 
               type="number" 
               className="h-8 max-w-[120px]" 
               value={invoiceAmount}
               onChange={(e) => setInvoiceAmount(e.target.value)}
             />
             <Input 
               placeholder="Description" 
               className="h-8" 
               value={invoiceDesc}
               onChange={(e) => setInvoiceDesc(e.target.value)}
             />
             <Button 
               variant="secondary" 
               size="sm" 
               className="h-8" 
               onClick={handleGenerateInvoice}
               disabled={generatingInv || !invoiceAmount}
             >
               {generatingInv ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
               Generate
             </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─────────── Communication Tab ─────────── */
const SchoolCommunicationView = ({ school }: { school: SaaSSchool }) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["saas-communications", school.id],
    queryFn: () => saasService.getCommunications(school.id),
  });
  const [selectedCommunication, setSelectedCommunication] = useState<SaasCommunication | null>(null);

  return (
    <div className="space-y-4">
       <div className="flex justify-between items-center gap-3">
         <div>
           <h4 className="text-sm font-semibold">Communication History</h4>
           <p className="text-xs text-muted-foreground">Track onboarding, billing, and support emails for this school.</p>
         </div>
         <Badge variant="outline" className="text-xs">
           {logs?.length || 0} tracked
         </Badge>
       </div>

       <div className="border rounded-md">
         {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
         ) : !logs || logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No communications recorded</div>
         ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead className="w-[190px]">Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[100px]">Category</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="text-muted-foreground">
                      <div>{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="text-[11px]">{new Date(log.created_at).toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell className="text-foreground">{log.recipient_email || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{log.subject || "No subject"}</div>
                      <div className="text-[11px] text-muted-foreground">{summarizeCommunicationContent(log.content)}</div>
                    </TableCell>
                    <TableCell className="capitalize">{formatCommunicationCategory(log.category)}</TableCell>
                    <TableCell>
                      <Badge variant={communicationBadgeVariant(log.status)} className="scale-90">
                        {formatCommunicationStatus(log.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCommunication(log)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
         )}
       </div>

      <CommunicationDetailDialog
        communication={selectedCommunication}
        schoolName={formatSchoolName(school.name)}
        open={!!selectedCommunication}
        onOpenChange={(open) => {
          if (!open) setSelectedCommunication(null);
        }}
      />
    </div>
  );
};

const PlatformEmailTracker = ({ schools }: { schools: SaaSSchool[] }) => {
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["saas-communications", "all"],
    queryFn: () => saasService.getCommunications(),
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedCommunication, setSelectedCommunication] = useState<SaasCommunication | null>(null);

  const schoolNames = new Map(schools.map((school) => [school.id, formatSchoolName(school.name)]));

  const filteredCommunications = communications.filter((communication) => {
    const schoolName = communication.school_id ? schoolNames.get(communication.school_id) || "" : "";
    const haystack = [
      schoolName,
      communication.recipient_email || "",
      communication.subject || "",
      communication.content || "",
      communication.error_message || "",
    ].join(" ").toLowerCase();

    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (communication.status || "").toLowerCase() === statusFilter;
    const matchesCategory = categoryFilter === "all" || (communication.category || "").toLowerCase() === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const sentCount = communications.filter((item) => item.status === "sent").length;
  const pendingCount = communications.filter((item) => item.status === "pending").length;
  const failedCount = communications.filter((item) => item.status === "failed").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> SaaS Email Tracking
        </CardTitle>
        <CardDescription className="text-xs">
          Review all platform email activity, delivery outcomes, and stored details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-950/30">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold text-foreground">{sentCount}</p>
          </div>
          <div className="rounded-lg border bg-amber-50/60 p-3 dark:bg-amber-950/30">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
          </div>
          <div className="rounded-lg border bg-destructive/5 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-foreground">{failedCount}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipient, school, subject, or error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-40 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full lg:w-40 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filteredCommunications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No tracked emails match the current filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Created</TableHead>
                  <TableHead className="w-[180px]">School</TableHead>
                  <TableHead className="w-[220px]">Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[90px] text-right">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommunications.map((communication) => (
                  <TableRow key={communication.id} className="text-xs">
                    <TableCell className="text-muted-foreground">
                      <div>{new Date(communication.created_at).toLocaleDateString()}</div>
                      <div className="text-[11px]">{new Date(communication.created_at).toLocaleTimeString()}</div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {communication.school_id ? schoolNames.get(communication.school_id) || `School #${communication.school_id}` : "Platform-wide"}
                    </TableCell>
                    <TableCell>{communication.recipient_email || "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{communication.subject || "No subject"}</div>
                      <div className="text-[11px] text-muted-foreground">{formatCommunicationCategory(communication.category)} · {summarizeCommunicationContent(communication.content)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={communicationBadgeVariant(communication.status)} className="scale-90">
                        {formatCommunicationStatus(communication.status)}
                      </Badge>
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
        </div>

        <CommunicationDetailDialog
          communication={selectedCommunication}
          schoolName={selectedCommunication?.school_id ? schoolNames.get(selectedCommunication.school_id) : "Platform-wide"}
          open={!!selectedCommunication}
          onOpenChange={(open) => {
            if (!open) setSelectedCommunication(null);
          }}
        />
      </CardContent>
    </Card>
  );
};

/* ─────────── School Detail / Edit Dialog ─────────── */
const SchoolDetailDialog = ({
  school, open, onOpenChange, accessProfile, portfolioStaff, tiers = []
}: {
  school: SaaSSchool;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accessProfile: PlatformAccessProfile;
  portfolioStaff: PlatformStaffMember[];
  tiers?: SaasTierFeature[];
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", country: "" });
  const [adminAccess, setAdminAccess] = useState({ adminEmail: "", adminPassword: "" });
  const [portfolioOwnerId, setPortfolioOwnerId] = useState("unassigned");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [repairingAdmin, setRepairingAdmin] = useState(false);
  const [assigningPortfolio, setAssigningPortfolio] = useState(false);

  const canEditSchool = accessProfile.can_edit_school_details;
  const canRepairAccess = accessProfile.can_resend_admin_access;
  const canManagePortfolios = accessProfile.can_manage_portfolios;

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name, email: school.email, phone: school.phone,
        city: school.city, country: school.country,
      });
      setAdminAccess({ adminEmail: school.email, adminPassword: "" });
      setPortfolioOwnerId(school.portfolio_owner_user_id || "unassigned");
      setEditing(false);
    }
  }, [school, open]);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    let pass = "";
    for (let i = 0; i < 12; i += 1) pass += chars.charAt(array[i] % chars.length);
    setAdminAccess((prev) => ({ ...prev, adminPassword: pass }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saasService.updateSchoolDetails(school.id, form);
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
      toast.success("School details updated");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update school");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePortfolio = async () => {
    setAssigningPortfolio(true);
    try {
      const nextOwnerId = portfolioOwnerId === "unassigned" ? null : portfolioOwnerId;
      await saasService.updateSchoolPortfolioOwner(
        school.id,
        nextOwnerId,
      );
      const nextOwner = nextOwnerId
        ? portfolioStaff.find((staff) => staff.user_id === nextOwnerId) || null
        : null;

      queryClient.setQueryData<SaaSSchool[]>(["saas-schools"], (currentSchools = []) =>
        currentSchools.map((currentSchool) =>
          currentSchool.id === school.id
            ? {
                ...currentSchool,
                portfolio_owner_user_id: nextOwnerId,
                portfolio_owner_name: nextOwner?.full_name || "",
                portfolio_owner_email: nextOwner?.email || "",
                portfolio_owner_role: nextOwner?.primary_role || "",
              }
            : currentSchool,
        ),
      );

      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      toast.success(portfolioOwnerId === "unassigned" ? "Portfolio assignment cleared" : "Portfolio owner updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update portfolio owner");
    } finally {
      setAssigningPortfolio(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    try {
      await saasService.sendOnboardingNotification(
        school.id, school.code, school.name, school.email, ""
      );
      toast.success(`Onboarding email resent to ${school.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  const handleRepairAndResendAdmin = async () => {
    if (!adminAccess.adminEmail || !adminAccess.adminPassword) {
      toast.error("Enter the admin email and a temporary password first");
      return;
    }

    setRepairingAdmin(true);
    try {
      await saasService.provisionSchoolAdminAccess({
        schoolId: school.id,
        schoolCode: school.code,
        schoolName: form.name || school.name,
        schoolEmail: form.email || school.email,
        contactPerson: "",
        adminEmail: adminAccess.adminEmail,
        adminPassword: adminAccess.adminPassword,
      });
      toast.success(`Admin access updated and emailed to ${adminAccess.adminEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend admin access");
    } finally {
      setRepairingAdmin(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{editing ? "Edit School" : "School Details"}</DialogTitle>
              <DialogDescription>
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{school.code}</code>
              </DialogDescription>
            </div>
            {!editing && canEditSchool && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subscription">Subscriptions</TabsTrigger>
              <TabsTrigger value="communication">Communication</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-4">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">School Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">City</Label>
                      <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Name" value={formatSchoolName(school.name)} />
                    <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={school.email} />
                    <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={school.phone || "—"} />
                    <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="City" value={school.city || "—"} />
                    <DetailRow icon={<Globe className="w-3.5 h-3.5" />} label="Country" value={school.country || "—"} />
                    <DetailRow icon={<Users className="w-3.5 h-3.5" />} label="Portfolio Owner" value={school.portfolio_owner_name || "Unassigned"} />
                    <DetailRow icon={<CalendarDays className="w-3.5 h-3.5" />} label="Created" value={new Date(school.created_at).toLocaleDateString()} />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-lg font-bold text-foreground">{school.student_count}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-lg font-bold text-foreground">{school.teacher_count}</p>
                      <p className="text-xs text-muted-foreground">Teachers</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <Badge variant="outline" className="text-xs">
                        {school.subscription_plan}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">Plan</p>
                    </div>
                  </div>
                  {canManagePortfolios && (
                    <>
                      <Separator />
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Portfolio ownership</p>
                          <p className="text-xs text-muted-foreground">Assign this school to an account manager or marketer.</p>
                        </div>
                        <Select value={portfolioOwnerId} onValueChange={setPortfolioOwnerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select portfolio owner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {portfolioStaff
                              .filter((staff) => ["account_manager", "marketer", "platform_admin"].includes(staff.primary_role))
                              .map((staff) => (
                                <SelectItem key={staff.user_id} value={staff.user_id}>
                                  {staff.full_name} · {getRoleLabel(staff.primary_role)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="outline" onClick={handleSavePortfolio} disabled={assigningPortfolio}>
                          {assigningPortfolio ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                          Save Portfolio Owner
                        </Button>
                      </div>
                    </>
                  )}
                  {canRepairAccess && (
                    <>
                      <Separator />
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">Admin access</p>
                            <p className="text-xs text-muted-foreground">
                              Repair the linked admin account and resend fresh login details.
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={generatePassword}>
                            Generate Password
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Admin Email</Label>
                            <Input
                              type="email"
                              value={adminAccess.adminEmail}
                              onChange={(e) => setAdminAccess((prev) => ({ ...prev, adminEmail: e.target.value }))}
                              placeholder="admin@school.com"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                            <Input
                              value={adminAccess.adminPassword}
                              onChange={(e) => setAdminAccess((prev) => ({ ...prev, adminPassword: e.target.value }))}
                              placeholder="Set a temporary password"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleRepairAndResendAdmin}
                          disabled={repairingAdmin}
                          className="gap-1.5"
                        >
                          {repairingAdmin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                          Repair & Resend Admin Access
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="subscription" className="pt-4">
              <SchoolSubscriptionView school={school} tiers={tiers} />
            </TabsContent>

            <TabsContent value="communication" className="pt-4">
              <SchoolCommunicationView school={school} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </>
          ) : (
            canRepairAccess && (
              <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={resending} className="gap-1.5">
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Resend Onboarding Email
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-start gap-2">
    <span className="text-muted-foreground mt-0.5">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  </div>
);

/* ─────────── Status Badge ─────────── */
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    trial: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    expired: "bg-destructive/10 text-destructive border-destructive/20",
    suspended: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[11px] font-medium capitalize ${styles[status] || styles.suspended}`}>
      {status}
    </Badge>
  );
};

/* ─────────── School Card ─────────── */
const SchoolCard = ({
  school, onToggle, onPlanChange, onView, onDelete, canManageSchoolStatus, canManageSubscriptions, canDeleteSchool
}: {
  school: SaaSSchool;
  onToggle: () => void;
  onPlanChange: (plan: string) => void;
  onView: () => void;
  onDelete: () => void;
  canManageSchoolStatus: boolean;
  canManageSubscriptions: boolean;
  canDeleteSchool: boolean;
}) => (
  <Card className={`group transition-all hover:shadow-lg hover:-translate-y-[2px] ${!school.active ? "opacity-60" : ""}`}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-4">
        <button onClick={onView} className="text-left min-w-0 flex-1 focus:outline-none">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {formatSchoolName(school.name)}
              </h3>
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{school.code}</code>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground ml-[42px]">
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {school.student_count}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {school.teacher_count}</span>
            {school.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {school.city}</span>}
          </div>
          <div className="ml-[42px] mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              {school.portfolio_owner_name || "Unassigned portfolio"}
            </Badge>
            {school.portfolio_owner_role && (
              <span className="capitalize">{getRoleLabel(school.portfolio_owner_role)}</span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={school.subscription_status} />
          <Select value={school.subscription_plan} onValueChange={onPlanChange} disabled={!canManageSubscriptions}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={school.active ? "destructive" : "default"}
            size="icon"
            className="h-8 w-8"
            onClick={onToggle}
            title={school.active ? "Deactivate" : "Activate"}
            disabled={!canManageSchoolStatus}
          >
            {school.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          </Button>

          {canDeleteSchool && (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Delete School"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete School</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete <strong>{school.name}</strong>? This action will remove all associated data and cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogTrigger asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogTrigger>
                  <Button
                    variant="destructive"
                    onClick={onDelete}
                  >
                    Confirm Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

/* ─────────── Stat Card ─────────── */
const StatCard = ({ icon: Icon, value, label, accent }: {
  icon: React.ElementType; value: number | undefined; label: string; accent: string;
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value ?? "—"}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const AccessSummaryCard = ({ accessProfile }: { accessProfile: PlatformAccessProfile }) => {
  const rules = ACCESS_RULES[accessProfile.primary_role] || { allowed: [], blocked: [] };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" /> {getRoleLabel(accessProfile.primary_role)} Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">Scope: {accessProfile.scope}</Badge>
          <Badge variant="outline">Schools: {accessProfile.accessible_school_count}</Badge>
          {accessProfile.roles.map((role) => (
            <Badge key={role} variant="secondary">{getRoleLabel(role)}</Badge>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Allowed</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {rules.allowed.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Not allowed</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {rules.blocked.length ? rules.blocked.map((item) => <li key={item}>• {item}</li>) : <li>• Full platform access granted</li>}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ─────────── Main Page ─────────── */
const SaaSDashboardPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SaaSSchool | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: accessProfile, isLoading: accessLoading } = useQuery({
    queryKey: ["saas-access-profile", user?.id],
    queryFn: () => saasService.getAccessProfile(),
    enabled: !!user,
  });

  useEffect(() => {
    if (authLoading || accessLoading) return;
    if (!user) {
      navigate("/saas/login", { replace: true });
      return;
    }
    if (!accessProfile?.can_view_dashboard) {
      navigate("/saas/login", { replace: true });
    }
  }, [user, authLoading, accessLoading, accessProfile, navigate]);

  const authorized = accessProfile?.can_view_dashboard === true;
  const canOnboardSchools = accessProfile?.can_onboard_schools === true || accessProfile?.primary_role === "marketer";
  const canManageSchoolStatus = accessProfile?.can_manage_school_status === true;
  const canManageSubscriptions = accessProfile?.can_manage_subscriptions === true;
  const canManagePortfolios = accessProfile?.can_manage_portfolios === true;
  const canViewAuditLogs = accessProfile?.can_view_audit_logs === true;
  const canDeleteSchools = accessProfile?.primary_role === "platform_admin"; // Only platform admins can delete

  const { data: analytics } = useQuery({
    queryKey: ["saas-analytics"],
    queryFn: () => saasService.getAnalytics(),
    enabled: authorized,
  });

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["saas-schools"],
    queryFn: () => saasService.getAllSchools(),
    enabled: authorized,
  });

  useEffect(() => {
    if (!selectedSchool) return;
    const refreshedSchool = schools.find((school) => school.id === selectedSchool.id);
    if (refreshedSchool) {
      setSelectedSchool(refreshedSchool);
    }
  }, [schools, selectedSchool?.id]);

  const { data: tiers = [] } = useQuery({
    queryKey: ["saas-tiers"],
    queryFn: () => saasService.getTierFeatures(),
    enabled: authorized,
  });

  const { data: dueSubscriptions = [], isLoading: dueLoading } = useQuery({
    queryKey: ["saas-due-subscriptions"],
    queryFn: () => saasService.getDueSubscriptions(14),
    enabled: authorized,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["saas-audit-logs"],
    queryFn: () => saasService.getAuditLogs(50),
    enabled: authorized && canViewAuditLogs,
  });

  const { data: portfolioStaff = [] } = useQuery({
    queryKey: ["saas-portfolio-staff"],
    queryFn: () => saasService.listPlatformStaff(),
    enabled: authorized && canManagePortfolios,
  });

  const { data: managedUsers = [], isLoading: managedUsersLoading } = useQuery({
    queryKey: ["saas-managed-users"],
    queryFn: () => saasService.listManagedUsers(),
    enabled: authorized && canManagePortfolios,
  });

  const { data: allInvoices = [], isLoading: allInvoicesLoading } = useQuery({
    queryKey: ["saas-all-invoices"],
    queryFn: () => saasService.getInvoices(),
    enabled: authorized && (accessProfile?.primary_role === "platform_admin" || accessProfile?.primary_role === "support"),
  });

  const dueTrialCount = dueSubscriptions.filter((d) => (d.subscription_status || "").includes("trial")).length;
  const dueRenewalCount = dueSubscriptions.filter((d) => (d.days_left ?? 9999) >= 0 && (d.days_left ?? 9999) <= 14 && !(d.subscription_status || "").includes("trial")).length;
  const overdueInvoices = dueSubscriptions.filter((d) => (d.invoice_status || "") === "overdue").length;

  const filteredSchools = schools.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && s.active) ||
      (statusFilter === "inactive" && !s.active) ||
      s.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSchoolMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      saasService.updateSchoolStatus(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
      toast.success("School status updated");
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, plan, status }: { id: number; plan: string; status: string }) =>
      saasService.updateSubscription(id, plan, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
      toast.success("Subscription updated");
    },
  });

  const deleteSchoolMutation = useMutation({
    mutationFn: (id: number) => saasService.deleteSchool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
      toast.success("School deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete school");
    },
  });

  const createManagedUserMutation = useMutation({
    mutationFn: (payload: { email: string; first_name: string; last_name: string; role: string; password: string }) =>
      saasService.createManagedUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["saas-portfolio-staff"] });
      toast.success("User created successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.email?.[0] || err.message || "Failed to create user");
    },
  });

  const deleteManagedUserMutation = useMutation({
    mutationFn: (userId: number) => saasService.deleteManagedUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saas-managed-users"] });
      queryClient.invalidateQueries({ queryKey: ["saas-portfolio-staff"] });
      toast.success("User deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete user");
    },
  });

  if (authLoading || (user && accessLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading platform...</p>
        </div>
      </div>
    );
  }

  if (!authorized || !accessProfile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground leading-tight">SkoolTrack Platform</h1>
              <p className="text-[11px] text-muted-foreground">Management Console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {accessProfile && <AccessSummaryCard accessProfile={accessProfile} />}

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} value={analytics?.total_schools} label={accessProfile?.scope === "portfolio" ? "Portfolio Schools" : "Total Schools"} accent="bg-primary/10 text-primary" />
          <StatCard icon={CheckCircle} value={analytics?.active_schools} label={accessProfile?.scope === "portfolio" ? "Active Portfolio Schools" : "Active Schools"} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />
          <StatCard icon={GraduationCap} value={analytics?.total_students} label={accessProfile?.scope === "portfolio" ? "Portfolio Students" : "Total Students"} accent="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" />
          <StatCard icon={Users} value={analytics?.total_teachers} label={accessProfile?.scope === "portfolio" ? "Portfolio Teachers" : "Total Teachers"} accent="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" />
        </div>

        {/* Plan Distribution */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Starter", count: analytics?.schools_on_starter ?? 0, color: "border-l-4 border-l-muted-foreground" },
            { label: "Standard", count: analytics?.schools_on_standard ?? 0, color: "border-l-4 border-l-blue-500" },
            { label: "Enterprise", count: analytics?.schools_on_enterprise ?? 0, color: "border-l-4 border-l-primary" },
          ].map((p) => (
            <Card key={p.label} className={`${p.color} overflow-hidden`}>
              <CardContent className="py-4 px-5">
                <p className="text-2xl font-bold text-foreground">{p.count}</p>
                <p className="text-xs text-muted-foreground font-medium">{p.label} Plan</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Billing Overview */}
        {(accessProfile?.primary_role === "platform_admin" || accessProfile?.primary_role === "support") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                <CardContent className="pt-4">
                   <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Total Revenue (Paid)</span>
                   </div>
                   <p className="text-2xl font-bold">KES {(allInvoices || []).filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()}</p>
                </CardContent>
             </Card>
             <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                <CardContent className="pt-4">
                   <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Pending Collections</span>
                   </div>
                   <p className="text-2xl font-bold">KES {(allInvoices || []).filter(inv => ['draft', 'sent', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()}</p>
                </CardContent>
             </Card>
             <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <CardContent className="pt-4">
                   <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Active Subscriptions</span>
                   </div>
                   <p className="text-2xl font-bold">{schools.filter(s => s.subscription_status === 'active').length}</p>
                </CardContent>
             </Card>
          </div>
        )}

        {/* Due Soon Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Due Soon & Overdue
            </CardTitle>
            <CardDescription className="text-xs">Trials expiring, renewals within 14 days, and overdue invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-amber-50 text-amber-800 border border-amber-200 p-3">
                <p className="text-xl font-bold">{dueTrialCount}</p>
                <p className="text-[11px] uppercase tracking-wide">Trials Expiring</p>
              </div>
              <div className="rounded-lg bg-blue-50 text-blue-800 border border-blue-200 p-3">
                <p className="text-xl font-bold">{dueRenewalCount}</p>
                <p className="text-[11px] uppercase tracking-wide">Renewals ≤ 14d</p>
              </div>
              <div className="rounded-lg bg-red-50 text-red-800 border border-red-200 p-3">
                <p className="text-xl font-bold">{overdueInvoices}</p>
                <p className="text-[11px] uppercase tracking-wide">Overdue Invoices</p>
              </div>
            </div>

            {dueLoading ? (
              <div className="py-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading due items...</div>
            ) : dueSubscriptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No trials or renewals due within 14 days.</p>
            ) : (
              <div className="space-y-2">
                {dueSubscriptions.slice(0, 5).map((item) => (
                  <div key={`${item.school_id}-${item.invoice_id || "none"}`} className="flex items-center justify-between rounded border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.school_name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.subscription_plan} · {item.subscription_status}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {item.invoice_status === "overdue" ? (
                        <span className="text-red-700">Overdue invoice</span>
                      ) : item.subscription_end ? (
                        <span>{item.days_left ?? "—"} days left</span>
                      ) : (
                        <span>Due soon</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="schools">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="schools" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="w-3.5 h-3.5" /> Schools
            </TabsTrigger>
            {(accessProfile?.primary_role === "platform_admin" || accessProfile?.primary_role === "support") && (
              <TabsTrigger value="usage" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="w-3.5 h-3.5" /> Usage Reports
              </TabsTrigger>
            )}
            {(accessProfile?.primary_role === "platform_admin" || accessProfile?.primary_role === "support") && (
              <TabsTrigger value="billing" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <CreditCard className="w-3.5 h-3.5" /> Global Billing
              </TabsTrigger>
            )}
            <TabsTrigger value="communications" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <MessageSquare className="w-3.5 h-3.5" /> Communication Hub
            </TabsTrigger>
            {canManagePortfolios && (
              <TabsTrigger value="management" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <UserCog className="w-3.5 h-3.5" /> Platform Management
              </TabsTrigger>
            )}
            {canViewAuditLogs && (
              <TabsTrigger value="audit" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Activity className="w-3.5 h-3.5" /> Audit Logs
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="schools" className="space-y-4 mt-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-36 text-xs">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              {canOnboardSchools && (
                <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Onboard School</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Onboard New School</DialogTitle>
                      <DialogDescription>Register a new school and set up their admin account</DialogDescription>
                    </DialogHeader>
                    <OnboardForm onSuccess={() => {
                      setOnboardOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
                      queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
                    }} />
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {/* Results count */}
            <p className="text-xs text-muted-foreground">
              {filteredSchools.length} school{filteredSchools.length !== 1 ? "s" : ""}
              {statusFilter !== "all" && ` (${statusFilter})`}
            </p>

            {/* School List */}
            <div className="space-y-3">
              {schoolsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSchools.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground font-medium">No schools found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter</p>
                </div>
              ) : (
                filteredSchools.map((school) => (
                  <SchoolCard
                    key={school.id}
                    school={school}
                    onToggle={() => toggleSchoolMutation.mutate({ id: school.id, active: !school.active })}
                    onPlanChange={(plan) => updatePlanMutation.mutate({ id: school.id, plan, status: school.subscription_status })}
                    onView={() => { setSelectedSchool(school); setDetailOpen(true); }}
                    onDelete={() => deleteSchoolMutation.mutate(school.id)}
                    canManageSchoolStatus={canManageSchoolStatus}
                    canManageSubscriptions={canManageSubscriptions}
                    canDeleteSchool={canDeleteSchools}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="usage" className="mt-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                   <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                         <Users className="w-4 h-4 text-primary" /> Student Enrollment Trends
                      </CardTitle>
                      <CardDescription className="text-xs">Top schools by student population and capacity utilization.</CardDescription>
                   </CardHeader>
                   <CardContent>
                      <div className="space-y-4">
                         {schools.sort((a, b) => b.student_count - a.student_count).slice(0, 5).map(s => (
                            <div key={s.id} className="space-y-1">
                               <div className="flex justify-between text-xs font-medium">
                                  <span>{formatSchoolName(s.name)}</span>
                                  <span>{s.student_count} Students</span>
                               </div>
                               <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-primary h-full transition-all"
                                    style={{ width: `${Math.min((s.student_count / 1000) * 100, 100)}%` }}
                                  />
                               </div>
                            </div>
                         ))}
                      </div>
                   </CardContent>
                </Card>

                <Card>
                   <CardHeader>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                         <Shield className="w-4 h-4 text-primary" /> Plan Adoption
                      </CardTitle>
                      <CardDescription className="text-xs">Distribution of subscription tiers across the platform.</CardDescription>
                   </CardHeader>
                   <CardContent className="flex flex-col items-center justify-center py-6">
                      <div className="grid grid-cols-3 gap-8 w-full text-center">
                         <div>
                            <p className="text-2xl font-bold">{schools.filter(s => s.subscription_plan === 'starter').length}</p>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Starter</p>
                         </div>
                         <div>
                            <p className="text-2xl font-bold">{schools.filter(s => s.subscription_plan === 'standard').length}</p>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Standard</p>
                         </div>
                         <div>
                            <p className="text-2xl font-bold">{schools.filter(s => s.subscription_plan === 'enterprise').length}</p>
                            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Enterprise</p>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>

             <Card className="mt-4">
                <CardHeader>
                   <CardTitle className="text-sm font-semibold">Detailed School Activity Log</CardTitle>
                   <CardDescription className="text-xs">Latest onboarding and system updates per school.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="rounded-md border">
                      <Table>
                         <TableHeader>
                            <TableRow>
                               <TableHead>School</TableHead>
                               <TableHead>Code</TableHead>
                               <TableHead>Status</TableHead>
                               <TableHead>Created At</TableHead>
                               <TableHead>Account Manager</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {schools.slice(0, 10).map(s => (
                               <TableRow key={s.id} className="text-xs">
                                  <TableCell className="font-medium">{formatSchoolName(s.name)}</TableCell>
                                  <TableCell className="font-mono">{s.code}</TableCell>
                                  <TableCell><StatusBadge status={s.subscription_status} /></TableCell>
                                  <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                                  <TableCell>{s.portfolio_owner_name || "—"}</TableCell>
                               </TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </div>
                </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" /> Comprehensive Billing Dashboard
                </CardTitle>
                <CardDescription className="text-xs">Manage invoices, track revenue, and monitor payment status across all schools.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>School</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allInvoicesLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : allInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No invoices found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        allInvoices.map((inv) => (
                          <TableRow key={inv.id} className="text-xs">
                            <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                            <TableCell className="font-medium">{formatSchoolName(schools.find(s => s.id === inv.school_id)?.name || `School #${inv.school_id}`)}</TableCell>
                            <TableCell className="font-semibold">KES {Number(inv.amount).toLocaleString()}</TableCell>
                            <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'secondary'}>
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                                 const s = schools.find(sch => sch.id === inv.school_id);
                                 if (s) {
                                   setSelectedSchool(s);
                                   setDetailOpen(true);
                                 }
                              }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="mt-4">
            <AdminCommunicationHub schools={schools} />
          </TabsContent>

          <TabsContent value="management" className="mt-4">
            <StaffManagementTab
              users={managedUsers}
              isLoading={managedUsersLoading}
              canManagePortfolios={canManagePortfolios}
              onCreateUser={(payload) => createManagedUserMutation.mutate(payload)}
              onDeleteUser={(userId) => deleteManagedUserMutation.mutate(userId)}
              creating={createManagedUserMutation.isPending}
              deletingUserId={deleteManagedUserMutation.isPending ? (deleteManagedUserMutation.variables as number) : null}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">No audit logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {auditLogs.map((log, idx) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">
                            {log.action} <span className="text-muted-foreground font-normal">in</span> {log.module}
                          </p>
                          {log.entity_type && (
                            <p className="text-xs text-muted-foreground">{log.entity_type} #{log.entity_id}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* School Detail Dialog */}
      {selectedSchool && (
        <SchoolDetailDialog
          school={selectedSchool}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          accessProfile={accessProfile!}
          portfolioStaff={portfolioStaff}
          tiers={tiers}
        />
      )}
    </div>
  );
};

/* ─────────── Onboard Form ─────────── */
const OnboardForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", country: "Kenya",
    plan: "starter", contact_person: "", contact_phone: "",
    admin_email: "", admin_password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ school_id: number; school_code: string } | null>(null);
  const [notificationSent, setNotificationSent] = useState(false);
  const [createAdmin, setCreateAdmin] = useState(true);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "object" && error && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
    return fallback;
  };

  const handleEmailChange = (val: string) => {
    setForm((prev) => ({
      ...prev, email: val,
      admin_email: prev.admin_email === prev.email || !prev.admin_email ? val : prev.admin_email,
    }));
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    let pass = "";
    for (let i = 0; i < 12; i++) pass += chars.charAt(array[i] % chars.length);
    setForm({ ...form, admin_password: pass });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createAdmin && (!form.admin_email || !form.admin_password)) {
      toast.error("Please fill in the admin email and password");
      return;
    }
    setSubmitting(true);
    try {
      const normalizedName = formatSchoolName(form.name);
      if (import.meta.env.DEV) {
        console.info("Onboarding Step 1: Creating school record", { schoolName: normalizedName });
      }
      const res = await saasService.onboardSchool({ ...form, name: normalizedName });

      try {
        if (import.meta.env.DEV) {
          console.info("Onboarding Step 2: Initializing onboarding workflow", { schoolId: res.school_id });
        }
        await saasService.initializeSchoolOnboarding(res.school_id, {
          source: "saas_dashboard",
          priority: "MEDIUM",
        });
      } catch (workflowErr: unknown) {
        toast.error(getErrorMessage(workflowErr, "School created, but onboarding workflow initialization failed"));
        return;
      }

      setResult(res);
      if (import.meta.env.DEV) {
        console.info("Onboarding Step 5: Completed", { schoolId: res.school_id, schoolCode: res.school_code });
      }
      toast.success(`School onboarded! Code: ${res.school_code}`);
      onSuccess();

      void (async () => {
        let adminCredentialsReady = false;

        if (createAdmin && form.admin_email && form.admin_password) {
          try {
            if (import.meta.env.DEV) {
              console.info("Onboarding Step 3: Provisioning school admin access", { schoolId: res.school_id, adminEmail: form.admin_email });
            }
            await saasService.provisionSchoolAdminAccess({
              schoolId: res.school_id,
              schoolCode: res.school_code,
              schoolName: normalizedName,
              schoolEmail: form.email,
              contactPerson: form.contact_person,
              adminEmail: form.admin_email,
              adminPassword: form.admin_password,
            });
            adminCredentialsReady = true;
            setNotificationSent(true);
            toast.success("School admin account created and emailed");
          } catch (adminErr: unknown) {
            toast.error(`Admin account creation failed: ${getErrorMessage(adminErr, "Unknown error")}`);
          }
        }

        if (!adminCredentialsReady) {
          try {
            if (import.meta.env.DEV) {
              console.info("Onboarding Step 4: Sending onboarding notification", { schoolId: res.school_id });
            }
            await saasService.sendOnboardingNotification(
              res.school_id,
              res.school_code,
              normalizedName,
              form.email,
              form.contact_person,
              undefined,
              undefined,
            );
            setNotificationSent(true);
            toast.success("Onboarding email sent");
          } catch {
            toast.error("School created, but notification email failed");
          }
        }
      })();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to onboard school"));
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="text-center space-y-4 py-6">
        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
          <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">School Created!</p>
          <p className="text-sm text-muted-foreground mt-1">The school has been successfully onboarded</p>
        </div>
        <div className="bg-muted rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">School Code</p>
          <p className="text-2xl font-mono font-bold text-primary">{result.school_code}</p>
        </div>
        {createAdmin && (
          <div className="bg-muted rounded-lg p-3 text-left text-sm space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Admin Credentials</p>
            <p className="font-medium text-foreground">{form.admin_email}</p>
            <p className="font-mono text-xs text-muted-foreground">{form.admin_password}</p>
          </div>
        )}
        {notificationSent && (
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Mail className="w-4 h-4" /> Login details emailed to {form.email}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">School Information</Label>
        <div className="space-y-3 mt-2">
          <Input placeholder="School Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="School Email *" type="email" required value={form.email} onChange={(e) => handleEmailChange(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Contact Person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <Input placeholder="Contact Phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscription</Label>
        <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
          <SelectTrigger className="mt-2"><SelectValue placeholder="Plan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={createAdmin} onChange={(e) => setCreateAdmin(e.target.checked)} className="rounded" />
          <span className="font-medium text-foreground">Create school admin account</span>
        </label>
      </div>

      {createAdmin && (
        <div className="space-y-3 pl-3 border-l-2 border-primary/20">
          <Input placeholder="Admin Email *" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          <div className="flex gap-2">
            <Input placeholder="Password *" type="text" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} className="font-mono text-sm" />
            <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="shrink-0 text-xs">Generate</Button>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : "Onboard School"}
      </Button>
    </form>
  );
};

export default SaaSDashboardPage;
