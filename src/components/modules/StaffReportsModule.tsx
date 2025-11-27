import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';

const StaffReportsModule = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reportType, setReportType] = useState('staff-list');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getStaff();
      setStaff(data);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.info('Export functionality coming soon');
  };

  const renderStaffListReport = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee No</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Job Title</TableHead>
          <TableHead>Employment Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Gross Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => {
          const grossSalary = (
            (member.basic_salary || 0) +
            (member.house_allowance || 0) +
            (member.transport_allowance || 0) +
            (member.responsibility_allowance || 0) +
            (member.other_allowances || 0)
          );
          
          return (
            <TableRow key={member.id}>
              <TableCell>{member.employee_no}</TableCell>
              <TableCell>{member.full_name || `${member.first_name} ${member.last_name}`}</TableCell>
              <TableCell>{member.department}</TableCell>
              <TableCell>{member.job_title}</TableCell>
              <TableCell>{member.employment_type}</TableCell>
              <TableCell>{member.status}</TableCell>
              <TableCell>KSh {grossSalary.toLocaleString()}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const renderDepartmentSummary = () => {
    const byDepartment: { [key: string]: { count: number, totalSalary: number } } = {};
    
    staff.forEach(member => {
      if (member.department) {
        if (!byDepartment[member.department]) {
          byDepartment[member.department] = { count: 0, totalSalary: 0 };
        }
        byDepartment[member.department].count++;
        const grossSalary = (
          (member.basic_salary || 0) +
          (member.house_allowance || 0) +
          (member.transport_allowance || 0) +
          (member.responsibility_allowance || 0) +
          (member.other_allowances || 0)
        );
        byDepartment[member.department].totalSalary += grossSalary;
      }
    });

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Department</TableHead>
            <TableHead>Number of Staff</TableHead>
            <TableHead>Total Payroll</TableHead>
            <TableHead>Average Salary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(byDepartment).map(([dept, data]) => (
            <TableRow key={dept}>
              <TableCell className="font-medium">{dept}</TableCell>
              <TableCell>{data.count}</TableCell>
              <TableCell>KSh {data.totalSalary.toLocaleString()}</TableCell>
              <TableCell>KSh {(data.totalSalary / data.count).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderPayrollSummary = () => {
    let totalBasic = 0;
    let totalHouse = 0;
    let totalTransport = 0;
    let totalResponsibility = 0;
    let totalOther = 0;
    let totalGross = 0;

    staff.filter(s => s.status === 'Active').forEach(member => {
      totalBasic += member.basic_salary || 0;
      totalHouse += member.house_allowance || 0;
      totalTransport += member.transport_allowance || 0;
      totalResponsibility += member.responsibility_allowance || 0;
      totalOther += member.other_allowances || 0;
      totalGross += (
        (member.basic_salary || 0) +
        (member.house_allowance || 0) +
        (member.transport_allowance || 0) +
        (member.responsibility_allowance || 0) +
        (member.other_allowances || 0)
      );
    });

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Basic Salary</TableCell>
              <TableCell className="text-right">KSh {totalBasic.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>House Allowance</TableCell>
              <TableCell className="text-right">KSh {totalHouse.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Transport Allowance</TableCell>
              <TableCell className="text-right">KSh {totalTransport.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Responsibility Allowance</TableCell>
              <TableCell className="text-right">KSh {totalResponsibility.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Other Allowances</TableCell>
              <TableCell className="text-right">KSh {totalOther.toLocaleString()}</TableCell>
            </TableRow>
            <TableRow className="font-bold">
              <TableCell>Total Gross Payroll</TableCell>
              <TableCell className="text-right text-lg">KSh {totalGross.toLocaleString()}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Staff Reports</h2>
        <Button onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Generate Report
            </CardTitle>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff-list">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Staff List
                  </div>
                </SelectItem>
                <SelectItem value="department-summary">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Department Summary
                  </div>
                </SelectItem>
                <SelectItem value="payroll-summary">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Payroll Summary
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              {reportType === 'staff-list' && renderStaffListReport()}
              {reportType === 'department-summary' && renderDepartmentSummary()}
              {reportType === 'payroll-summary' && renderPayrollSummary()}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffReportsModule;