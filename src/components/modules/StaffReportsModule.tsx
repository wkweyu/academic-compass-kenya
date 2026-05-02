import { useState, useEffect } from 'react';
import { staffService, TeacherWorkload } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, Users, Briefcase, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const StaffReportsModule = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [workloads, setWorkloads] = useState<TeacherWorkload[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('staff-list');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, workloadData] = await Promise.all([
        staffService.getStaff(),
        staffService.getAllTeachersWorkload()
      ]);
      setStaff(staffData);
      setWorkloads(workloadData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.info('Export functionality coming soon');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const calculateGrossSalary = (member: Staff) => {
    return (
      (member.basic_salary || 0) +
      (member.house_allowance || 0) +
      (member.transport_allowance || 0) +
      (member.responsibility_allowance || 0) +
      (member.other_allowances || 0)
    );
  };

  // Staff List Report
  const renderStaffListReport = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee No</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Job Title</TableHead>
          <TableHead>Employment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Gross Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-mono">{member.employee_no}</TableCell>
            <TableCell className="font-medium">{member.full_name || `${member.first_name} ${member.last_name}`}</TableCell>
            <TableCell>
              <Badge variant="outline">{member.staff_category}</Badge>
            </TableCell>
            <TableCell>{member.department}</TableCell>
            <TableCell>{member.job_title}</TableCell>
            <TableCell>{member.employment_type}</TableCell>
            <TableCell>
              <Badge 
                className={
                  member.status === 'Active' ? 'bg-green-100 text-green-800' :
                  member.status === 'On Leave' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {member.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(calculateGrossSalary(member))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // Department Summary Report
  const renderDepartmentSummary = () => {
    const byDepartment: { [key: string]: { count: number; totalSalary: number; active: number } } = {};
    
    staff.forEach(member => {
      const dept = member.department || 'Unassigned';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { count: 0, totalSalary: 0, active: 0 };
      }
      byDepartment[dept].count++;
      byDepartment[dept].totalSalary += calculateGrossSalary(member);
      if (member.status === 'Active') byDepartment[dept].active++;
    });

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Department</TableHead>
            <TableHead className="text-center">Total Staff</TableHead>
            <TableHead className="text-center">Active</TableHead>
            <TableHead className="text-right">Total Payroll</TableHead>
            <TableHead className="text-right">Average Salary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byDepartment)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([dept, data]) => (
              <TableRow key={dept}>
                <TableCell className="font-medium">{dept}</TableCell>
                <TableCell className="text-center">{data.count}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{data.active}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.totalSalary)}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(Math.round(data.totalSalary / data.count))}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    );
  };

  // Payroll Summary Report
  const renderPayrollSummary = () => {
    const activeStaff = staff.filter(s => s.status === 'Active');
    
    let totalBasic = 0;
    let totalHouse = 0;
    let totalTransport = 0;
    let totalResponsibility = 0;
    let totalOther = 0;

    activeStaff.forEach(member => {
      totalBasic += member.basic_salary || 0;
      totalHouse += member.house_allowance || 0;
      totalTransport += member.transport_allowance || 0;
      totalResponsibility += member.responsibility_allowance || 0;
      totalOther += member.other_allowances || 0;
    });

    const totalGross = totalBasic + totalHouse + totalTransport + totalResponsibility + totalOther;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Active Staff</p>
                <p className="text-3xl font-bold">{activeStaff.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Total Monthly Payroll</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(totalGross)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Average Salary</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(activeStaff.length > 0 ? Math.round(totalGross / activeStaff.length) : 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Basic Salary</TableCell>
              <TableCell className="text-right">{formatCurrency(totalBasic)}</TableCell>
              <TableCell className="text-right">{totalGross > 0 ? Math.round((totalBasic / totalGross) * 100) : 0}%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>House Allowance</TableCell>
              <TableCell className="text-right">{formatCurrency(totalHouse)}</TableCell>
              <TableCell className="text-right">{totalGross > 0 ? Math.round((totalHouse / totalGross) * 100) : 0}%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Transport Allowance</TableCell>
              <TableCell className="text-right">{formatCurrency(totalTransport)}</TableCell>
              <TableCell className="text-right">{totalGross > 0 ? Math.round((totalTransport / totalGross) * 100) : 0}%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Responsibility Allowance</TableCell>
              <TableCell className="text-right">{formatCurrency(totalResponsibility)}</TableCell>
              <TableCell className="text-right">{totalGross > 0 ? Math.round((totalResponsibility / totalGross) * 100) : 0}%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Other Allowances</TableCell>
              <TableCell className="text-right">{formatCurrency(totalOther)}</TableCell>
              <TableCell className="text-right">{totalGross > 0 ? Math.round((totalOther / totalGross) * 100) : 0}%</TableCell>
            </TableRow>
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Total Gross Payroll</TableCell>
              <TableCell className="text-right text-lg">{formatCurrency(totalGross)}</TableCell>
              <TableCell className="text-right">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  // Workload Report
  const renderWorkloadReport = () => {
    const teachingStaff = workloads.filter(w => w.assignments.length > 0 || w.total_lessons > 0);
    const overloaded = teachingStaff.filter(w => w.is_overloaded);

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Teaching Staff</p>
                  <p className="text-2xl font-bold">{workloads.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Briefcase className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">With Assignments</p>
                  <p className="text-2xl font-bold">{teachingStaff.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Normal Workload</p>
                  <p className="text-2xl font-bold">{teachingStaff.length - overloaded.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={overloaded.length > 0 ? 'border-destructive' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-8 w-8 ${overloaded.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Overloaded</p>
                  <p className="text-2xl font-bold">{overloaded.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workload Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead className="text-center">Subjects</TableHead>
              <TableHead className="text-center">Classes</TableHead>
              <TableHead className="text-center">Weekly Lessons</TableHead>
              <TableHead className="text-center">Limit</TableHead>
              <TableHead>Workload</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workloads.map((workload) => (
              <TableRow key={workload.teacher_id} className={workload.is_overloaded ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">{workload.teacher_name}</TableCell>
                <TableCell className="text-center">{workload.total_subjects}</TableCell>
                <TableCell className="text-center">{workload.total_classes}</TableCell>
                <TableCell className="text-center">{workload.total_lessons}</TableCell>
                <TableCell className="text-center">{workload.weekly_limit}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={Math.min(workload.workload_percentage, 100)} 
                      className={`h-2 w-24 ${workload.is_overloaded ? '[&>div]:bg-destructive' : ''}`}
                    />
                    <span className="text-sm">{workload.workload_percentage}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {workload.is_overloaded ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Overloaded
                    </Badge>
                  ) : workload.total_lessons === 0 ? (
                    <Badge variant="secondary">No Assignments</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">Normal</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Category Summary
  const renderCategorySummary = () => {
    const byCategory: { [key: string]: { count: number; active: number; totalSalary: number } } = {};
    
    staff.forEach(member => {
      const cat = member.staff_category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, active: 0, totalSalary: 0 };
      }
      byCategory[cat].count++;
      if (member.status === 'Active') byCategory[cat].active++;
      byCategory[cat].totalSalary += calculateGrossSalary(member);
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Object.entries(byCategory).map(([cat, data]) => (
            <Card key={cat}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground line-clamp-1">{cat}</p>
                  <p className="text-3xl font-bold">{data.count}</p>
                  <p className="text-sm text-muted-foreground">{data.active} active</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-center">Inactive/Leave</TableHead>
              <TableHead className="text-right">Total Payroll</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(byCategory).map(([cat, data]) => (
              <TableRow key={cat}>
                <TableCell className="font-medium">{cat}</TableCell>
                <TableCell className="text-center">{data.count}</TableCell>
                <TableCell className="text-center">
                  <Badge className="bg-green-100 text-green-800">{data.active}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{data.count - data.active}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.totalSalary)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="staff-list" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="staff-list">Staff List</TabsTrigger>
            <TabsTrigger value="department">By Department</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="workload">Workload</TabsTrigger>
          </TabsList>
          
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        <TabsContent value="staff-list">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Complete Staff List
              </CardTitle>
              <CardDescription>All staff members with employment details</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : (
                renderStaffListReport()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="department">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Department Summary
              </CardTitle>
              <CardDescription>Staff distribution and payroll by department</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Loading...</div> : renderDepartmentSummary()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff by Category
              </CardTitle>
              <CardDescription>Teaching, Administrative, Support, and other staff categories</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Loading...</div> : renderCategorySummary()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Payroll Summary
              </CardTitle>
              <CardDescription>Monthly payroll breakdown for active staff</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Loading...</div> : renderPayrollSummary()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workload">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Teacher Workload Analysis
              </CardTitle>
              <CardDescription>Weekly lesson allocation and workload status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Loading...</div> : renderWorkloadReport()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffReportsModule;