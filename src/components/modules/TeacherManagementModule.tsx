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
import { Teacher, TeacherStats, TeacherFilters, DEPARTMENTS, EMPLOYMENT_TYPES, TEACHER_STATUS_OPTIONS } from '@/types/teacher';
import { teacherService } from '@/services/teacherService';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

export const TeacherManagementModule = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TeacherFilters>({});
  const [isCreateTeacherOpen, setIsCreateTeacherOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [deleteTeacherId, setDeleteTeacherId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teacherData, statsData] = await Promise.all([
        teacherService.getTeachers(filters),
        teacherService.getTeacherStats()
      ]);
      
      setTeachers(teacherData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load teacher data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeacher = async (id: number) => {
    try {
      await teacherService.deleteTeacher(id);
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete teacher",
        variant: "destructive",
      });
    } finally {
      setDeleteTeacherId(null);
    }
  };

  const getStatusColor = (status: string) => {
    const statusOption = TEACHER_STATUS_OPTIONS.find(s => s.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold tracking-tight">Teacher Management</h1>
          <p className="text-muted-foreground">
            Manage teacher records, assignments, and payroll
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Reports
          </Button>
          
          <Dialog open={isCreateTeacherOpen} onOpenChange={setIsCreateTeacherOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>
                  Enter teacher details for HR and payroll records.
                </DialogDescription>
              </DialogHeader>
              <div className="text-center py-8 text-muted-foreground">
                Teacher form component will be implemented next...
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_teachers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_teachers} active
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
              <div className="text-2xl font-bold">{stats.teachers_on_leave}</div>
              <p className="text-xs text-muted-foreground">
                Currently away
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="teachers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="teachers">Teachers</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teacher Records</CardTitle>
              <CardDescription>Manage teacher personal and employment information</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <Input
                    placeholder="Search teachers..."
                    value={filters.search || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="max-w-sm"
                  />
                </div>
                
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
                    {TEACHER_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Teachers Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee No.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Gross Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map((teacher) => (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium">{teacher.employee_no}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{teacher.full_name}</div>
                          <div className="text-sm text-muted-foreground">{teacher.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{teacher.department}</TableCell>
                      <TableCell>{teacher.job_title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{teacher.employment_type}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(teacher.gross_salary || 0)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(teacher.status)}>
                          {teacher.status}
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
                            onClick={() => setDeleteTeacherId(teacher.id)}
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
          <Card>
            <CardHeader>
              <CardTitle>Subject & Class Assignments</CardTitle>
              <CardDescription>Manage teacher assignments to subjects and classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Assignment management will be implemented next...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Management</CardTitle>
              <CardDescription>Process monthly payroll and generate payslips</CardDescription>
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
              <CardTitle>Teacher Attendance</CardTitle>
              <CardDescription>Track daily attendance and leave management</CardDescription>
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
        isOpen={deleteTeacherId !== null}
        onOpenChange={(isOpen) => !isOpen && setDeleteTeacherId(null)}
        onConfirm={() => deleteTeacherId && handleDeleteTeacher(deleteTeacherId)}
        title="Delete Teacher"
        description="This will permanently remove the teacher record. This action cannot be undone."
      />
    </div>
  );
};