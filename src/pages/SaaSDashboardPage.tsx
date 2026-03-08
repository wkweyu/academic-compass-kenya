import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { saasService, SaaSSchool } from "@/services/saasService";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, Users, GraduationCap, Plus, Power, PowerOff,
  Shield, LogOut, Clock, CheckCircle, Search, Mail, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";

const SaaSDashboardPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/saas/login", { replace: true }); return; }
    
    // Use user.id directly to avoid getUser() race condition
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

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

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
      toast.success("Subscription updated");
    },
  });

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      active: "bg-green-500/10 text-green-700 border-green-500/20",
      trial: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      expired: "bg-destructive/10 text-destructive border-destructive/20",
      suspended: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={variants[status] || variants.suspended}>
        {status}
      </Badge>
    );
  };

  if (authLoading || authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SkoolTrack Platform Admin</h1>
            <p className="text-xs text-muted-foreground">SaaS Management Console</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Building2, value: analytics?.total_schools, label: "Total Schools", color: "text-primary" },
            { icon: CheckCircle, value: analytics?.active_schools, label: "Active Schools", color: "text-green-600" },
            { icon: GraduationCap, value: analytics?.total_students, label: "Total Students", color: "text-blue-600" },
            { icon: Users, value: analytics?.total_teachers, label: "Total Teachers", color: "text-purple-600" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  <div>
                    <p className="text-2xl font-bold">{stat.value ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Starter", count: analytics?.schools_on_starter ?? 0, color: "text-muted-foreground" },
            { label: "Standard", count: analytics?.schools_on_standard ?? 0, color: "text-blue-600" },
            { label: "Enterprise", count: analytics?.schools_on_enterprise ?? 0, color: "text-primary" },
          ].map((p) => (
            <Card key={p.label}>
              <CardContent className="pt-4 pb-4 text-center">
                <p className={`text-xl font-bold ${p.color}`}>{p.count}</p>
                <p className="text-xs text-muted-foreground">{p.label} Plan</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="schools">
          <TabsList>
            <TabsTrigger value="schools">Schools</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="schools" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="w-4 h-4" /> Onboard School</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Onboard New School</DialogTitle>
                    <DialogDescription>Create a new school on the platform</DialogDescription>
                  </DialogHeader>
                  <OnboardForm onSuccess={() => {
                    setOnboardOpen(false);
                    queryClient.invalidateQueries({ queryKey: ["saas-schools"] });
                    queryClient.invalidateQueries({ queryKey: ["saas-analytics"] });
                  }} />
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {schoolsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading schools...</p>
              ) : filteredSchools.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No schools found</p>
              ) : (
                filteredSchools.map((school) => (
                  <Card key={school.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground truncate">{school.name}</h3>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{school.code}</code>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{school.student_count} students</span>
                            <span>{school.teacher_count} teachers</span>
                            {school.city && <span>{school.city}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {statusBadge(school.subscription_status)}
                          <Select
                            value={school.subscription_plan}
                            onValueChange={(plan) =>
                              updatePlanMutation.mutate({ id: school.id, plan, status: school.subscription_status })
                            }
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
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
                            size="sm"
                            onClick={() => toggleSchoolMutation.mutate({ id: school.id, active: !school.active })}
                          >
                            {school.active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Audit Logs</CardTitle></CardHeader>
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No audit logs yet</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {log.action} <span className="text-muted-foreground">in</span> {log.module}
                          </p>
                          {log.entity_type && (
                            <p className="text-xs text-muted-foreground">{log.entity_type} #{log.entity_id}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Onboard form with email notification trigger
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

  // Auto-fill admin email from school email
  const handleEmailChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      email: val,
      admin_email: prev.admin_email === prev.email || !prev.admin_email ? val : prev.admin_email,
    }));
  };

  // Generate random password
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pass = "";
    for (let i = 0; i < 12; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
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

      // Create admin user if requested
      if (createAdmin && form.admin_email && form.admin_password) {
        try {
          await saasService.createSchoolAdmin(
            res.school_id, form.admin_email, form.admin_password
          );
          toast.success("School admin account created");
        } catch (adminErr: any) {
          toast.error(`Admin account creation failed: ${adminErr.message}`);
        }
      }

      // Send onboarding notification with login details
      try {
        await saasService.sendOnboardingNotification(
          res.school_id, res.school_code, form.name, form.email, form.contact_person,
          createAdmin ? form.admin_email : undefined,
          createAdmin ? form.admin_password : undefined
        );
        setNotificationSent(true);
        toast.success("Onboarding email with login details sent");
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
      <div className="text-center space-y-3 py-4">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
        <p className="text-lg font-semibold">School Created!</p>
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">School Code</p>
          <p className="text-2xl font-mono font-bold text-foreground">{result.school_code}</p>
        </div>
        {createAdmin && (
          <div className="bg-muted p-3 rounded-lg text-left text-sm space-y-1">
            <p className="text-muted-foreground">Admin Login:</p>
            <p className="font-medium text-foreground">{form.admin_email}</p>
            <p className="font-mono text-xs text-muted-foreground">{form.admin_password}</p>
          </div>
        )}
        {notificationSent && (
          <div className="flex items-center justify-center gap-2 text-sm text-green-700">
            <Mail className="w-4 h-4" /> Login details emailed to {form.email}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">School Info</p>
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
      <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
        <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="standard">Standard</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>

      <div className="border-t border-border pt-3 mt-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={createAdmin}
            onChange={(e) => setCreateAdmin(e.target.checked)}
            className="rounded"
          />
          <span className="font-medium text-foreground">Create school admin account</span>
        </label>
      </div>

      {createAdmin && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
          <Input
            placeholder="Admin Email *"
            type="email"
            value={form.admin_email}
            onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Password *"
              type="text"
              value={form.admin_password}
              onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
              className="font-mono text-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={generatePassword} className="shrink-0 text-xs">
              Generate
            </Button>
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating..." : "Onboard School"}
      </Button>
    </form>
  );
};

export default SaaSDashboardPage;
