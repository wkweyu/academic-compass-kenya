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
  UserCog
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
import { userService, UserProfile } from "@/services/userService";
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
  const [newRole, setNewRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["school-users"],
    queryFn: () => userService.getUsers(),
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

  const handleToggleLogin = (user: UserProfile) => {
    enableLoginMutation.mutate({
      entity_type: user.entity_type || 'staff',
      entity_id: user.entity_id || user.id,
      email: user.email,
      login_enabled: !user.login_enabled,
      role: user.role,
    });
  };

  const handleChangeRole = () => {
    if (!selectedUser || !newRole) return;
    enableLoginMutation.mutate({
      entity_type: selectedUser.entity_type || 'staff',
      entity_id: selectedUser.entity_id || selectedUser.id,
      email: selectedUser.email,
      role: newRole,
      login_enabled: selectedUser.login_enabled,
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) return;
    enableLoginMutation.mutate({
      entity_type: selectedUser.entity_type || 'staff',
      entity_id: selectedUser.entity_id || selectedUser.id,
      email: selectedUser.email,
      password: newPassword,
      send_invite: sendInvite,
      login_enabled: selectedUser.login_enabled,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "default",
      INVITED: "secondary",
      DISABLED: "destructive",
      LOCKED: "destructive",
      EXPIRED: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Active School Accounts
          </CardTitle>
          <CardDescription>
            Manage login credentials and system access levels for school staff and administrators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No users found matching your filters.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Linked Entity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{user.full_name || user.username}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium capitalize">
                            {(user as any).linked_entity_name || user.entity_type || "N/A"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {user.entity_type ? `${user.entity_type} ID: #${user.entity_id}` : "No link"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${user.login_enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className="text-xs">{user.login_enabled ? "Enabled" : "Disabled"}</span>
                        </div>
                      </TableCell>
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
                          <DropdownMenuContent align="end" className="w-48">
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
          )}
        </CardContent>
      </Card>

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
              Set a new temporary password for {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  type="text"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
                    const array = new Uint8Array(10);
                    crypto.getRandomValues(array);
                    let pass = "";
                    for (let i = 0; i < 10; i++) pass += chars.charAt(array[i] % chars.length);
                    setNewPassword(pass);
                  }}
                >
                  Generate
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-invite"
                checked={sendInvite}
                onCheckedChange={(checked) => setSendInvite(!!checked)}
              />
              <Label htmlFor="send-invite" className="text-sm font-normal cursor-pointer">
                Send invitation email with new credentials
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={enableLoginMutation.isPending || !newPassword}>
              {enableLoginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
