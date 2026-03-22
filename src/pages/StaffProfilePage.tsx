import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { staffService } from '@/services/teacherService';
import { Staff, StaffSubjectAssignment } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, CreditCard, User, BookOpen, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

const StaffProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [assignments, setAssignments] = useState<StaffSubjectAssignment[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaffData();
  }, [id]);

  const loadStaffData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [staffData, assignmentsData, attendanceStats] = await Promise.all([
        staffService.getStaffMember(parseInt(id)),
        staffService.getStaffSubjects(parseInt(id)),
        staffService.getStaffAttendanceStats(parseInt(id)),
      ]);
      
      setStaff(staffData);
      setAssignments(assignmentsData);
      setAttendance(attendanceStats);
    } catch (error) {
      console.error('Error loading staff data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!staff) {
    return <div className="flex items-center justify-center h-screen">Staff member not found</div>;
  }

  const grossSalary = (
    (staff.basic_salary || 0) +
    (staff.house_allowance || 0) +
    (staff.transport_allowance || 0) +
    (staff.responsibility_allowance || 0) +
    (staff.other_allowances || 0)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'On Leave': return 'bg-blue-100 text-blue-800';
      case 'Suspended': return 'bg-yellow-100 text-yellow-800';
      case 'Terminated': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/teachers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Staff List
        </Button>
        <Button onClick={() => navigate(`/teachers/${id}/edit`)}>Edit Profile</Button>
      </div>

      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-12 h-12 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{staff.full_name || `${staff.first_name} ${staff.last_name}`}</h1>
                <Badge className={getStatusColor(staff.status)}>{staff.status}</Badge>
              </div>
              <p className="text-lg text-muted-foreground mb-4">{staff.job_title} - {staff.department}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{staff.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{staff.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{staff.employee_no}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Joined {format(new Date(staff.hire_date || staff.created_at), 'MMM yyyy')}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Subject Assignments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">First Name:</span>
                  <span className="font-medium">{staff.first_name}</span>
                  
                  <span className="text-muted-foreground">Last Name:</span>
                  <span className="font-medium">{staff.last_name}</span>
                  
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="font-medium">{staff.gender}</span>
                  
                  <span className="text-muted-foreground">Date of Birth:</span>
                  <span className="font-medium">{format(new Date(staff.date_of_birth), 'dd MMM yyyy')}</span>
                  
                  <span className="text-muted-foreground">National ID:</span>
                  <span className="font-medium">{staff.national_id || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">Passport No:</span>
                  <span className="font-medium">{staff.passport_no || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Employment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Employee No:</span>
                  <span className="font-medium">{staff.employee_no}</span>
                  
                  <span className="text-muted-foreground">TSC Number:</span>
                  <span className="font-medium">{staff.tsc_number || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{staff.staff_category}</span>
                  
                  <span className="text-muted-foreground">Job Title:</span>
                  <span className="font-medium">{staff.job_title}</span>
                  
                  <span className="text-muted-foreground">Department:</span>
                  <span className="font-medium">{staff.department}</span>
                  
                  <span className="text-muted-foreground">Employment Type:</span>
                  <span className="font-medium">{staff.employment_type}</span>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{staff.address || 'No address provided'}</span>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Emergency Contact:</p>
                    <p className="font-medium">{staff.emergency_contact_name || 'N/A'}</p>
                    <p className="text-muted-foreground">{staff.emergency_contact_phone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Banking & Tax */}
            <Card>
              <CardHeader>
                <CardTitle>Banking & Tax Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Bank Name:</span>
                  <span className="font-medium">{staff.bank_name || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">Bank Branch:</span>
                  <span className="font-medium">{staff.bank_branch || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">Account Number:</span>
                  <span className="font-medium">{staff.account_number || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">KRA PIN:</span>
                  <span className="font-medium">{staff.kra_pin || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">NHIF Number:</span>
                  <span className="font-medium">{staff.nhif_number || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">NSSF Number:</span>
                  <span className="font-medium">{staff.nssf_number || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Subject Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No subject assignments yet</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{assignment.subject_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {assignment.class_name}{assignment.stream_name && ` - ${assignment.stream_name}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Academic Year: {assignment.academic_year}</p>
                      </div>
                      {assignment.is_class_teacher && (
                        <Badge variant="secondary">Class Teacher</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Attendance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{attendance.total_days}</p>
                    <p className="text-sm text-muted-foreground">Total Days</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-green-50">
                    <p className="text-2xl font-bold text-green-600">{attendance.present}</p>
                    <p className="text-sm text-muted-foreground">Present</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-red-50">
                    <p className="text-2xl font-bold text-red-600">{attendance.absent}</p>
                    <p className="text-sm text-muted-foreground">Absent</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-yellow-50">
                    <p className="text-2xl font-bold text-yellow-600">{attendance.late}</p>
                    <p className="text-sm text-muted-foreground">Late</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-blue-50">
                    <p className="text-2xl font-bold text-blue-600">{attendance.attendance_rate.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No attendance data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payroll Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <span className="text-muted-foreground">Salary Scale:</span>
                  <span className="font-medium">{staff.salary_scale || 'N/A'}</span>
                  
                  <span className="text-muted-foreground">Basic Salary:</span>
                  <span className="font-medium">KSh {staff.basic_salary?.toLocaleString() || '0'}</span>
                  
                  <span className="text-muted-foreground">House Allowance:</span>
                  <span className="font-medium">KSh {staff.house_allowance?.toLocaleString() || '0'}</span>
                  
                  <span className="text-muted-foreground">Transport Allowance:</span>
                  <span className="font-medium">KSh {staff.transport_allowance?.toLocaleString() || '0'}</span>
                  
                  <span className="text-muted-foreground">Responsibility Allowance:</span>
                  <span className="font-medium">KSh {staff.responsibility_allowance?.toLocaleString() || '0'}</span>
                  
                  <span className="text-muted-foreground">Other Allowances:</span>
                  <span className="font-medium">KSh {staff.other_allowances?.toLocaleString() || '0'}</span>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Gross Salary:</span>
                    <span className="text-2xl font-bold text-primary">KSh {grossSalary.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffProfilePage;