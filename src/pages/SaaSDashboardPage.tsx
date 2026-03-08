import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { saasService, SaaSSchool } from "@/services/saasService";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, Users, GraduationCap, Plus, Power, PowerOff,
  Shield, LogOut, Clock, CheckCircle, Search, Mail, Loader2,
  Pencil, Send, Eye, X, ChevronDown, Activity, BarChart3,
  Globe, Phone, MapPin, CalendarDays, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/* ─────────── School Detail / Edit Dialog ─────────── */
const SchoolDetailDialog = ({
  school, open, onOpenChange
}: { school: SaaSSchool; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name, email: school.email, phone: school.phone,
        city: school.city, country: school.country,
      });
      setEditing(false);
    }
  }, [school, open]);

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
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                <DetailRow icon={<Building2 className="w-3.5 h-3.5" />} label="Name" value={school.name} />
                <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={school.email} />
                <DetailRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={school.phone || "—"} />
                <DetailRow icon={<MapPin className="w-3.5 h-3.5" />} label="City" value={school.city || "—"} />
                <DetailRow icon={<Globe className="w-3.5 h-3.5" />} label="Country" value={school.country || "—"} />
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
            </div>
          )}
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
            <Button variant="outline" size="sm" onClick={handleResendEmail} disabled={resending} className="gap-1.5">
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Resend Onboarding Email
            </Button>
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
  school, onToggle, onPlanChange, onView
}: {
  school: SaaSSchool;
  onToggle: () => void;
  onPlanChange: (plan: string) => void;
  onView: () => void;
}) => (
  <Card className={`group transition-all hover:shadow-md ${!school.active ? "opacity-60" : ""}`}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-4">
        <button onClick={onView} className="text-left min-w-0 flex-1 focus:outline-none">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {school.name}
              </h3>
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{school.code}</code>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground ml-[42px]">
            <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {school.student_count}</span>
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {school.teacher_count}</span>
            {school.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {school.city}</span>}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={school.subscription_status} />
          <Select value={school.subscription_plan} onValueChange={onPlanChange}>
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
          >
            {school.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
          </Button>
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

/* ─────────── Main Page ─────────── */
const SaaSDashboardPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SaaSSchool | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/saas/login", { replace: true }); return; }
    saasService.isPlatformAdmin(user.id).then((isAdmin) => {
      if (!isAdmin) navigate("/saas/login", { replace: true });
      else setAuthorized(true);
    });
  }, [user, authLoading, navigate]);

  const { data: analytics } = useQuery({
    queryKey: ["saas-analytics"],
    queryFn: () => saasService.getAnalytics(),
    enabled: authorized === true,
  });

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ["saas-schools"],
    queryFn: () => saasService.getAllSchools(),
    enabled: authorized === true,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["saas-audit-logs"],
    queryFn: () => saasService.getAuditLogs(50),
    enabled: authorized === true,
  });

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

  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading platform...</p>
        </div>
      </div>
    );
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
        {/* Analytics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} value={analytics?.total_schools} label="Total Schools" accent="bg-primary/10 text-primary" />
          <StatCard icon={CheckCircle} value={analytics?.active_schools} label="Active Schools" accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" />
          <StatCard icon={GraduationCap} value={analytics?.total_students} label="Total Students" accent="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" />
          <StatCard icon={Users} value={analytics?.total_teachers} label="Total Teachers" accent="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" />
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

        {/* Tabs */}
        <Tabs defaultValue="schools">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="schools" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Building2 className="w-3.5 h-3.5" /> Schools
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Activity className="w-3.5 h-3.5" /> Audit Logs
            </TabsTrigger>
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
                  />
                ))
              )}
            </div>
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
      const res = await saasService.onboardSchool(form);
      setResult(res);
      toast.success(`School onboarded! Code: ${res.school_code}`);

      if (createAdmin && form.admin_email && form.admin_password) {
        try {
          await saasService.createSchoolAdmin(res.school_id, form.admin_email, form.admin_password);
          toast.success("School admin account created");
        } catch (adminErr: any) {
          toast.error(`Admin account creation failed: ${adminErr.message}`);
        }
      }

      try {
        await saasService.sendOnboardingNotification(
          res.school_id, res.school_code, form.name, form.email, form.contact_person,
          createAdmin ? form.admin_email : undefined,
          createAdmin ? form.admin_password : undefined
        );
        setNotificationSent(true);
        toast.success("Onboarding email sent");
      } catch {
        toast.error("School created, but notification email failed");
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to onboard school");
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
