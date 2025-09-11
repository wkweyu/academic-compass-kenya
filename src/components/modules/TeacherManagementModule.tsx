import { useState, useEffect } from 'react';
import { Plus, Search, Users, DollarSign, Calendar, Filter, Edit, Trash2, Eye, UserCheck, FileText } from 'lucide-react';
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
import { TeachingAssignmentsTab } from '@/components/modules/TeachingAssignmentsTab';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

export const TeacherManagementModule = () => {
  console.log('TeacherManagementModule rendering...');
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
    } catch (error) {
      console.error('Error loading staff data:', error);
      toast({
        title: "Error",
        description: "Failed to load staff data",
        variant: "destructive",
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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create staff member",
        variant: "destructive",
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground">
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
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
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

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
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
          
          <Card>
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
          
          <Card>
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
          
          <Card>
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
      <Tabs defaultValue="staff" className="space-y-4">
        <TabsList>
          <TabsTrigger value="staff">All Staff</TabsTrigger>
          <TabsTrigger value="assignments">Teaching Assignments</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Records</CardTitle>
              <CardDescription>Manage all staff personal and employment information</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="flex-1 min-w-64">
                  <Input
                    placeholder="Search staff..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm"
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

              {/* Staff Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Employment Type</TableHead>
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
                        <Badge variant="secondary">{member.employment_type}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(member.gross_salary || 0)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(member.status)}>
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <TeachingAssignmentsTab />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Management</CardTitle>
              <CardDescription>Process monthly payroll and generate payslips for all staff</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Payroll management will be implemented next...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Attendance</CardTitle>
              <CardDescription>Track daily attendance and leave management for all staff</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Attendance tracking will be implemented next...
              </div>
            </CardContent>
          </Card>
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