import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, DollarSign, Calendar, Edit, Trash2, Eye, UserCheck, FileText, Crown, Briefcase, Sparkles, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Staff, StaffStats, StaffFilters, DEPARTMENTS, EMPLOYMENT_TYPES, STAFF_STATUS_OPTIONS, STAFF_CATEGORIES } from '@/types/teacher';
import { staffService } from '@/services/teacherService';
import { StaffForm } from '@/components/forms/StaffForm';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import StaffAttendanceModule from './StaffAttendanceModule';
import StaffReportsModule from './StaffReportsModule';
import TeacherAssignmentsModule from './TeacherAssignmentsModule';
import LeaveManagementModule from './LeaveManagementModule';
import TeacherAvailabilityModule from './TeacherAvailabilityModule';
import TeacherPerformanceModule from './TeacherPerformanceModule';
import TeacherWorkloadModule from './TeacherWorkloadModule';

interface TeacherManagementModuleProps {
  defaultTab?: string;
}

export const TeacherManagementModule = ({ defaultTab = 'staff' }: TeacherManagementModuleProps) => {
  console.log('TeacherManagementModule rendering...');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<StaffFilters>({});
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [deleteStaffId, setDeleteStaffId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    console.log('Loading staff data...');
    setLoading(true);
    try {
      const [staffData, statsData] = await Promise.all([
        staffService.getStaff(filters),
        staffService.getStaffStats()
      ]);
      
      console.log('Staff data loaded:', staffData.length, 'staff members');
      console.log('Stats loaded:', statsData);
      
      setStaff(staffData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Error loading staff data:', error);
      const errorMessage = error?.standardError?.message || error?.message || "Failed to load staff data";
      toast({
        title: "Backend Connection Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (data: Omit<Staff, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>) => {
    try {
      await staffService.createStaff(data);
      toast({
        title: "Success",
        description: "Staff member created successfully",
      });
      setIsCreateStaffOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error creating staff:', error);
      const errorMessage = error?.standardError?.message || error?.message || "Failed to create staff member";
      toast({
        title: "Backend Connection Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000, // Show for 10 seconds
      });
    }
  };

  const handleDeleteStaff = async (id: number) => {
    try {
      await staffService.deleteStaff(id);
      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      });
    } finally {
      setDeleteStaffId(null);
    }
  };

  const getStatusColor = (status: string) => {
    const statusOption = STAFF_STATUS_OPTIONS.find(s => s.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Teaching Staff': 'bg-blue-100 text-blue-800',
      'Administrative Staff': 'bg-purple-100 text-purple-800',
      'Support Staff': 'bg-green-100 text-green-800',
      'Security Staff': 'bg-orange-100 text-orange-800',
      'Maintenance Staff': 'bg-yellow-100 text-yellow-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Staff settings
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1 font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> HR operations
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
              <p className="mt-2 text-muted-foreground">
            Manage all staff records, assignments, and payroll (Teachers & Support Staff)
              </p>
            </div>
        
            <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Reports
          </Button>
          
          <Dialog open={isCreateStaffOpen} onOpenChange={setIsCreateStaffOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateStaffOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
                <DialogDescription>
                  Enter staff details for HR and payroll records (Teachers, Admin, Support, etc.).
                </DialogDescription>
              </DialogHeader>
              <StaffForm
                onSubmit={handleCreateStaff}
                onCancel={() => setIsCreateStaffOpen(false)}
              />
            </DialogContent>
          </Dialog>
            </div>
          </div>
      </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_staff}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_staff} active
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.total_payroll_cost)}</div>
              <p className="text-xs text-muted-foreground">
                Total gross salaries
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Experience</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.average_years_service)} years</div>
              <p className="text-xs text-muted-foreground">
                Average service
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Leave</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.staff_on_leave}</div>
              <p className="text-xs text-muted-foreground">
                Currently away
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue={defaultTab} className="space-y-4" key={defaultTab}>
        <TabsList className="h-auto flex-wrap gap-1 rounded-2xl border border-border/70 bg-muted/40 p-2">
          <TabsTrigger value="staff">All Staff</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Staff Records</CardTitle>
              <CardDescription>Manage all staff personal and employment information</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{staff.length} matching staff</Badge>
                  <Badge variant="secondary">Search and role filtering</Badge>
                  <Badge variant="secondary">Payroll overview</Badge>
                </div>

              <div className="flex gap-4 flex-wrap">
                <div className="relative min-w-64 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search staff..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm pl-10"
                  />
                </div>
                
                <Select
                  value={filters.staff_category || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    staff_category: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {STAFF_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={filters.department || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    department: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.employment_type || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    employment_type: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Employment Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {EMPLOYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    status: value === 'all' ? undefined : value 
                  }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STAFF_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>

              {/* Staff Table */}
              {staff.length === 0 && !loading ? (
                <div className="erp-muted-panel flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Users className="h-8 w-8 text-primary" />
                  <p className="mt-4 text-base font-semibold text-foreground">No staff records matched this view</p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Adjust the filters or add a new staff member to begin tracking assignments, payroll, and attendance.</p>
                </div>
              ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>HOD</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.employee_no}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{member.full_name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(member.staff_category)}>
                          {member.staff_category}
                        </Badge>
                      </TableCell>
                      <TableCell>{member.department}</TableCell>
                      <TableCell>{member.job_title}</TableCell>
                      <TableCell>
                        {(member as any).is_hod ? (
                          <Badge className="bg-amber-100 text-amber-800">
                            <Crown className="h-3 w-3 mr-1" />
                            HOD
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(member.gross_salary || 0)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                       <TableCell>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/teachers/${member.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteStaffId(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <TeacherAssignmentsModule />
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          <TeacherAvailabilityModule />
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <TeacherWorkloadModule />
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <StaffAttendanceModule />
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <LeaveManagementModule />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <TeacherPerformanceModule />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <StaffReportsModule />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteStaffId !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteStaffId(null)}
        onConfirm={() => deleteStaffId && handleDeleteStaff(deleteStaffId)}
        title="Delete Staff Member"
        description="This will permanently remove the staff record. This action cannot be undone."
      />
    </div>
  );
};