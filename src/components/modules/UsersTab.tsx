import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Mail,
  Power,
  PowerOff,
  Key,
  MoreVertical,
  History,
  AlertTriangle,
  Loader2,
  Trash2,
  Send,
  UserCog,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { userService, UserProfile, ActivityLog } from "@/services/userService";
import { toast } from "sonner";
import { format } from "date-fns";

const ROLE_LABELS: Record<string, string> = {
  schooladmin: "School Administrator",
  deputy_principal: "Deputy Principal",
  teacher: "Teacher",
  finance: "Finance Officer",
  accountant: "Accountant",
  librarian: "Librarian",
  transport: "Transport Officer",
  registrar: "Registrar",
  receptionist: "Receptionist",
  bursar: "Bursar",
  exams_officer: "Exams Officer",
};

export function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState("activity");
  const [newRole, setNewRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["school-users"],
    queryFn: () => userService.getUsers(),
  });

  const { data: history = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["user-history", selectedUser?.id],
    queryFn: () => selectedUser ? userService.getUserHistory(selectedUser.id) : Promise.resolve([]),
    enabled: isHistoryOpen && !!selectedUser && historyTab === "activity",
  });

  const { data: loginHistory = [], isLoading: isLoadingLoginHistory } = useQuery({
    queryKey: ["user-login-history", selectedUser?.id],
    queryFn: () => selectedUser ? userService.getLoginHistory(selectedUser.id) : Promise.resolve([]),
    enabled: isHistoryOpen && !!selectedUser && historyTab === "login",
  });

  const enableLoginMutation = useMutation({
    mutationFn: (payload: any) => userService.enableLogin(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-users"] });
      toast.success("User access updated successfully");
      setIsRoleDialogOpen(false);
      setIsPasswordDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update user access");
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => userService.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-users"] });
      toast.success("User deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete user");
    }
  });

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.full_name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.username.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const activeUsers = useMemo(() => filteredUsers.filter(u => u.login_enabled && u.status === 'ACTIVE'), [filteredUsers]);
  const pendingInvites = useMemo(() => filteredUsers.filter(u => u.status === 'INVITED' || u.status === 'PENDING_EMAIL_VERIFICATION'), [filteredUsers]);
  const disabledUsers = useMemo(() => filteredUsers.filter(u => !u.login_enabled || u.status === 'DISABLED'), [filteredUsers]);

  const handleToggleLogin = (user: UserProfile) => {
    enableLoginMutation.mutate({
      entity_type: user.entity_type || (user.role === 'teacher' ? 'teacher' : 'staff'),
      entity_id: user.entity_id,
      email: user.email,
      login_enabled: !user.login_enabled,
      role: user.role,
      send_invite: !user.login_enabled, // Send invite if we are enabling access
    });
  };

  const handleChangeRole = () => {
    if (!selectedUser || !newRole) return;
    enableLoginMutation.mutate({
      entity_type: selectedUser.entity_type || (selectedUser.role === 'teacher' ? 'teacher' : 'staff'),
      entity_id: selectedUser.entity_id,
      email: selectedUser.email,
      role: newRole,
      login_enabled: selectedUser.login_enabled,
    });
  };

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: number) => userService.resetPassword(userId),
    onSuccess: () => {
      toast.success("Password reset email sent successfully");
      setIsPasswordDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send reset email");
    }
  });

  const resendLoginMutation = useMutation({
    mutationFn: (userId: number) => userService.resendLoginDetails(userId),
    onSuccess: () => {
      toast.success("Login details resent successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to resend login details");
    }
  });

  const handleResetPassword = () => {
    if (!selectedUser) return;
    resetPasswordMutation.mutate(selectedUser.id);
  };

  const handleResendLogin = (userId: number) => {
    resendLoginMutation.mutate(userId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-0.5 h-6"><div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Active</Badge>;
      case 'INVITED':
        return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-0.5 h-6"><div className="h-1.5 w-1.5 rounded-full bg-amber-600" /> Invited</Badge>;
      case 'DISABLED':
        return <Badge variant="destructive" className="gap-1.5 py-0.5 h-6 bg-red-50 text-red-700 border-red-200 hover:bg-red-100"><div className="h-1.5 w-1.5 rounded-full bg-red-600" /> Disabled</Badge>;
      case 'LOCKED':
        return <Badge variant="destructive" className="gap-1.5 py-0.5 h-6 bg-slate-900 text-white border-slate-700"><div className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Locked</Badge>;
      case 'EXPIRED':
        return <Badge className="gap-1.5 py-0.5 h-6 bg-orange-100 text-orange-700 border-orange-200"><div className="h-1.5 w-1.5 rounded-full bg-orange-600" /> Expired</Badge>;
      default:
        return <Badge variant="outline" className="py-0.5 h-6">{status}</Badge>;
    }
  };

  const UserTable = ({ data }: { data: UserProfile[] }) => (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Linked Entity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.full_name || user.username}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-[11px] font-medium">
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold capitalize text-foreground">
                    {user.linked_entity_name || user.entity_type || "N/A"}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {user.entity_type ? <>{user.entity_type} <ChevronRight className="h-2 w-2" /> #{user.entity_id}</> : "No link"}
                  </span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(user.status)}</TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {user.last_login ? format(new Date(user.last_login), "MMM d, HH:mm") : "Never"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => handleToggleLogin(user)} className="gap-2">
                      {user.login_enabled ? (
                        <><PowerOff className="h-4 w-4 text-orange-500" /> Disable Access</>
                      ) : (
                        <><Power className="h-4 w-4 text-emerald-500" /> Enable Access</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedUser(user); setNewRole(user.role); setIsRoleDialogOpen(true); }} className="gap-2">
                      <UserCog className="h-4 w-4" /> Change Role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsPasswordDialogOpen(true); }} className="gap-2">
                      <Key className="h-4 w-4" /> Reset Password
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleResendLogin(user.id)} className="gap-2">
                      <Send className="h-4 w-4" /> Resend Login Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsHistoryOpen(true); }} className="gap-2">
                      <History className="h-4 w-4" /> View History
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      if (confirm(`Are you sure you want to delete the user account for ${user.email}? This will NOT delete the staff record.`)) {
                        deleteUserMutation.mutate(user.id);
                      }
                    }} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" /> Delete Account
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 border-b border-border/70 bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> School Accounts
                </CardTitle>
                <CardDescription className="text-xs">
                  Central management for all users with access to this school's data.
                </CardDescription>
              </div>
              <TabsList className="bg-background border h-9">
                <TabsTrigger value="all" className="text-xs">All ({filteredUsers.length})</TabsTrigger>
                <TabsTrigger value="active" className="text-xs">Active ({activeUsers.length})</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">Invited ({pendingInvites.length})</TabsTrigger>
                <TabsTrigger value="disabled" className="text-xs">Disabled ({disabledUsers.length})</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm">No accounts found matching your filters.</p>
              </div>
            ) : (
              <>
                <TabsContent value="all" className="m-0">
                  <UserTable data={filteredUsers} />
                </TabsContent>
                <TabsContent value="active" className="m-0">
                  <UserTable data={activeUsers} />
                </TabsContent>
                <TabsContent value="pending" className="m-0">
                  <UserTable data={pendingInvites} />
                </TabsContent>
                <TabsContent value="disabled" className="m-0">
                  <UserTable data={disabledUsers} />
                </TabsContent>
              </>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update system permissions for {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>System Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground pt-1">
                Roles define what modules and actions the user can access.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={enableLoginMutation.isPending}>
              {enableLoginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Account Password</DialogTitle>
            <DialogDescription>
              This will send a password reset email to {selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3 mt-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Send Reset Email?</p>
              <p>The user will receive a link to securely set their new password. We no longer generate temporary passwords in this dashboard for security reasons.</p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> User Logs & History
            </DialogTitle>
            <DialogDescription>
              Activities and login history for {selectedUser?.full_name} ({selectedUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <Tabs value={historyTab} onValueChange={setHistoryTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activity">Admin Activity Log</TabsTrigger>
              <TabsTrigger value="login">Login History</TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="py-4">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-4 opacity-10" />
                  <p className="text-sm">No activity recorded for this user.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                    {history.map((item: any) => (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full bg-background border-2 border-primary" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground capitalize">
                              {item.action.replace(/_/g, " ")}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground italic">
                            {item.ip_address && <span>IP: {item.ip_address}</span>}
                            {item.user_agent && <span className="truncate max-w-[200px]" title={item.user_agent}>Browser: {item.user_agent}</span>}
                          </div>
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div className="mt-2 p-2 rounded bg-muted/50 text-[10px] font-mono whitespace-pre-wrap truncate">
                              {JSON.stringify(item.metadata, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="login" className="py-4">
              {isLoadingLoginHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Power className="h-10 w-10 mx-auto mb-4 opacity-10" />
                  <p className="text-sm">No login attempts recorded.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Device/Browser</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginHistory.map((login: any) => (
                        <TableRow key={login.id}>
                          <TableCell className="text-xs">
                            {format(new Date(login.login_time), "MMM d, HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            {login.successful ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Success</Badge>
                            ) : (
                              <Badge variant="destructive" title={login.failure_reason}>Failed</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{login.ip_address || "-"}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground truncate max-w-[150px]" title={login.user_agent}>
                            {login.user_agent || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setIsHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
