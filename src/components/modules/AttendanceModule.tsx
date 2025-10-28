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

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .order('grade_level');
      if (error) throw error;
      return data || [];
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
  const filteredStudents = students?.filter(s => 
    !selectedStream || s.current_stream === selectedStream
  ) || [];

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

    const records = filteredStudents.map(student => ({
      studentId: parseInt(student.id),
      date: format(selectedDate, 'yyyy-MM-dd'),
      status: bulkStatus,
      classId: selectedClass && !isNaN(parseInt(selectedClass)) ? parseInt(selectedClass) : undefined,
      streamId: selectedStream && !isNaN(parseInt(selectedStream)) ? parseInt(selectedStream) : undefined
    }));

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
    return attendanceRecords?.find(a => a.student_id === parseInt(studentId));
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
                                  onClick={() => handleMarkAttendance(parseInt(student.id), option.value)}
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
          <Card>
            <CardHeader>
              <CardTitle>Attendance Reports</CardTitle>
              <CardDescription>View attendance analytics and generate reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                <p>Attendance reports coming soon...</p>
                <p className="text-sm mt-2">Will include daily, weekly, and monthly reports</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
