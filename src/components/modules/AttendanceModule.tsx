import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  CalendarIcon, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Download,
  Users,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  markAttendance, 
  bulkMarkAttendance, 
  getAttendanceByDate,
  getAttendanceStats,
  exportAttendanceToCSV
} from '@/services/attendanceService';
import { getStudents } from '@/services/studentService';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceStatus, ATTENDANCE_STATUS_OPTIONS } from '@/types/attendance';

export const AttendanceModule = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present');
  const [error, setError] = useState<string | null>(null);

  // Fetch classes
  const { data: classes, error: classesError } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('classes')
          .select('id, name, grade_level')
          .order('grade_level');
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        setError(err.message || 'Failed to load classes');
        throw err;
      }
    }
  });

  // Fetch streams for selected class
  const { data: streams } = useQuery({
    queryKey: ['streams', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await supabase
        .from('streams')
        .select('id, name')
        .eq('class_assigned_id', parseInt(selectedClass))
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClass
  });

  // Fetch students for selected class/stream
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students', selectedClass, selectedStream],
    queryFn: async () => {
      const filters: any = { status: 'active' };
      if (selectedClass) filters.class_id = selectedClass;
      return getStudents(filters);
    },
    enabled: !!selectedClass
  });

  // Filter students by stream if selected
  const filteredStudents = students?.filter(s => {
    if (!selectedStream) return true;
    return s.current_stream === selectedStream || s.current_stream === parseInt(selectedStream).toString();
  }) || [];

  // Fetch attendance for selected date
  const { data: attendanceRecords } = useQuery({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd'), selectedClass, selectedStream],
    queryFn: () => getAttendanceByDate(
      format(selectedDate, 'yyyy-MM-dd'),
      selectedClass ? parseInt(selectedClass) : undefined,
      selectedStream ? parseInt(selectedStream) : undefined
    ),
    enabled: !!selectedClass
  });

  // Fetch attendance statistics
  const { data: stats } = useQuery({
    queryKey: ['attendance-stats', selectedClass, selectedStream],
    queryFn: () => getAttendanceStats(
      selectedClass ? parseInt(selectedClass) : undefined,
      selectedStream ? parseInt(selectedStream) : undefined
    )
  });

  // Mark single attendance mutation
  const markMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: number; status: AttendanceStatus }) =>
      markAttendance(studentId, format(selectedDate, 'yyyy-MM-dd'), status, {
        classId: selectedClass ? parseInt(selectedClass) : undefined,
        streamId: selectedStream ? parseInt(selectedStream) : undefined
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mark attendance');
    }
  });

  // Bulk mark mutation
  const bulkMutation = useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      
      if (result.failed > 0) {
        toast.warning(`Marked ${result.success} students, ${result.failed} failed`);
      } else {
        toast.success(`Successfully marked ${result.success} students as ${bulkStatus}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mark attendance');
    }
  });

  const handleMarkAttendance = (studentId: number, status: AttendanceStatus) => {
    markMutation.mutate({ studentId, status });
  };

  const handleBulkMark = () => {
    if (!selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    if (filteredStudents.length === 0) {
      toast.error('No students found');
      return;
    }

    const records = filteredStudents
      .map(student => {
        const studentId = parseInt(student.id);
        if (isNaN(studentId)) {
          console.error('Invalid student ID:', student.id);
          return null;
        }
        return {
          studentId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status: bulkStatus,
          classId: selectedClass && !isNaN(parseInt(selectedClass)) ? parseInt(selectedClass) : undefined,
          streamId: selectedStream && !isNaN(parseInt(selectedStream)) ? parseInt(selectedStream) : undefined
        };
      })
      .filter((record): record is NonNullable<typeof record> => record !== null);

    if (records.length === 0) {
      toast.error('No valid student records to mark');
      return;
    }

    bulkMutation.mutate(records);
  };

  const handleExport = async () => {
    try {
      const blob = await exportAttendanceToCSV({
        class_id: selectedClass ? parseInt(selectedClass) : undefined,
        stream_id: selectedStream ? parseInt(selectedStream) : undefined,
        date_from: format(selectedDate, 'yyyy-MM-dd'),
        date_to: format(selectedDate, 'yyyy-MM-dd')
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${format(selectedDate, 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Attendance exported successfully');
    } catch (error) {
      toast.error('Failed to export attendance');
    }
  };

  const getStudentAttendance = (studentId: string) => {
    if (!attendanceRecords) return undefined;
    const id = parseInt(studentId);
    if (isNaN(id)) return undefined;
    return attendanceRecords.find(a => a.student_id === id);
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const option = ATTENDANCE_STATUS_OPTIONS.find(opt => opt.value === status);
    if (!option) return null;
    
    return (
      <Badge className={option.color}>
        <span className="mr-1">{option.icon}</span>
        {option.label}
      </Badge>
    );
  };

  // Show error if there's a critical issue
  if (error || classesError) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error Loading Attendance Module</CardTitle>
            <CardDescription className="text-red-700">
              {error || classesError?.message || 'An unexpected error occurred'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">
            Mark and track daily student attendance
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.attendance_rate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.present} present out of {stats.total_records}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance</CardTitle>
              <CardDescription>Mark attendance for students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes?.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Stream (Optional)</Label>
                  <Select value={selectedStream} onValueChange={setSelectedStream}>
                    <SelectTrigger>
                      <SelectValue placeholder="All streams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Streams</SelectItem>
                      {streams?.map((stream) => (
                        <SelectItem key={stream.id} value={stream.id.toString()}>
                          {stream.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Bulk Mark As</Label>
                  <div className="flex gap-2">
                    <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as AttendanceStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.icon} {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkMark}
                      disabled={!selectedClass || filteredStudents.length === 0}
                    >
                      Mark All
                    </Button>
                  </div>
                </div>
              </div>

              {/* Student List */}
              {!selectedClass ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4" />
                  <p>Please select a class to view students</p>
                </div>
              ) : studentsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Loading students...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="mx-auto h-12 w-12 mb-4" />
                  <p>No students found for selected class/stream</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admission No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Stream</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const attendance = getStudentAttendance(student.id);
                      const studentIdNum = parseInt(student.id);
                      
                      if (isNaN(studentIdNum)) {
                        console.error('Invalid student ID:', student.id);
                        return null;
                      }
                      
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.admission_number}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>{student.current_class_name}</TableCell>
                          <TableCell>{student.current_stream_name}</TableCell>
                          <TableCell>
                            {attendance ? getStatusBadge(attendance.status) : (
                              <Badge variant="outline">Not Marked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {ATTENDANCE_STATUS_OPTIONS.slice(0, 3).map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  variant={attendance?.status === option.value ? 'default' : 'outline'}
                                  onClick={() => handleMarkAttendance(studentIdNum, option.value)}
                                  title={option.label}
                                >
                                  {option.icon}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="space-y-4">
            {/* Reports Header */}
            <Card>
              <CardHeader>
                <CardTitle>Attendance Analytics & Reports</CardTitle>
                <CardDescription>Generate detailed attendance reports and analyze trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Date Range Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Report Period</Label>
                    <Select defaultValue="this_week">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_term">This Term</SelectItem>
                        <SelectItem value="this_year">This Year</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Class Filter</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger>
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Classes</SelectItem>
                        {classes?.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id.toString()}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Stream Filter</Label>
                    <Select value={selectedStream} onValueChange={setSelectedStream}>
                      <SelectTrigger>
                        <SelectValue placeholder="All streams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Streams</SelectItem>
                        {streams?.map((stream) => (
                          <SelectItem key={stream.id} value={stream.id.toString()}>
                            {stream.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                {stats && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-700">{stats.present}</div>
                        <p className="text-xs text-green-600 mt-1">
                          {stats.attendance_rate}% attendance rate
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-red-50 border-red-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                        <XCircle className="h-4 w-4 text-red-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-700">{stats.absent}</div>
                        <p className="text-xs text-red-600 mt-1">
                          Requires follow-up
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-700">{stats.late}</div>
                        <p className="text-xs text-yellow-600 mt-1">
                          Tardiness tracking
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Excused</CardTitle>
                        <FileText className="h-4 w-4 text-blue-600" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{stats.excused + stats.sick}</div>
                        <p className="text-xs text-blue-600 mt-1">
                          With documentation
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Report Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Daily Report
                  </Button>
                  <Button variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Weekly Summary
                  </Button>
                  <Button variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Monthly Trends
                  </Button>
                  <Button variant="outline">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Absentee Report
                  </Button>
                </div>

                {/* Late Arrivals Tracking */}
                <Card className="border-yellow-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      Late Arrival Tracking
                    </CardTitle>
                    <CardDescription>Students who arrived late today</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords?.filter(a => a.status === 'late').length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
                        <p>No late arrivals today - excellent punctuality!</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Time In</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceRecords
                            ?.filter(a => a.status === 'late')
                            .map((record) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  Student #{record.student_id}
                                </TableCell>
                                <TableCell>Class info</TableCell>
                                <TableCell>
                                  {record.time_in || 'Not recorded'}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {record.reason || 'No reason provided'}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {/* Absence Alerts */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      Absence Notifications
                    </CardTitle>
                    <CardDescription>Students absent today - requires parent notification</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {attendanceRecords?.filter(a => a.status === 'absent').length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <CheckCircle className="mx-auto h-8 w-8 text-green-600 mb-2" />
                        <p>Perfect attendance today - no absences!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-red-900">Action Required</h4>
                              <p className="text-sm text-red-700 mt-1">
                                {attendanceRecords?.filter(a => a.status === 'absent').length} student(s) marked absent. 
                                Parents/guardians should be notified via SMS or phone call.
                              </p>
                            </div>
                            <Button size="sm" variant="destructive">
                              Send Notifications
                            </Button>
                          </div>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Class/Stream</TableHead>
                              <TableHead>Guardian Contact</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attendanceRecords
                              ?.filter(a => a.status === 'absent')
                              .map((record) => (
                                <TableRow key={record.id}>
                                  <TableCell className="font-medium">
                                    Student #{record.student_id}
                                  </TableCell>
                                  <TableCell>Class info</TableCell>
                                  <TableCell className="text-sm">
                                    <div>Phone: +254 XXX XXX XXX</div>
                                    <div className="text-muted-foreground">Email available</div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="destructive">Not Notified</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button size="sm" variant="outline">
                                      Notify
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Attendance Trends */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Attendance Trends & Patterns
                    </CardTitle>
                    <CardDescription>Historical attendance analysis</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-12 text-muted-foreground">
                      <TrendingUp className="mx-auto h-12 w-12 mb-4" />
                      <p className="font-medium">Trend Analysis Coming Soon</p>
                      <p className="text-sm mt-2">
                        Will include: Weekly trends, Monthly patterns, Class comparisons, 
                        Individual student attendance history, Predictive insights
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
