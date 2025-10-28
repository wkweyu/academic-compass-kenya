import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Download,
  Users,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'sick' | 'left_early';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-800', icon: '✓' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-800', icon: '✗' },
  { value: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-800', icon: '⏰' },
];

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

  // Fetch streams
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

  // Fetch students
  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-attendance', selectedClass, selectedStream],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('id, admission_number, full_name, current_class_id, current_stream_id')
        .eq('is_active', true);
      
      if (selectedClass) {
        query = query.eq('current_class_id', parseInt(selectedClass));
      }
      
      if (selectedStream) {
        query = query.eq('current_stream_id', parseInt(selectedStream));
      }
      
      const { data, error } = await query.order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClass
  });

  // Fetch attendance
  const { data: attendanceRecords } = useQuery({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd'), selectedClass, selectedStream],
    queryFn: async () => {
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));
      
      if (selectedClass) {
        query = query.eq('class_id', parseInt(selectedClass));
      }
      
      if (selectedStream) {
        query = query.eq('stream_id', parseInt(selectedStream));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClass
  });

  // Mark attendance mutation
  const markMutation = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: number; status: AttendanceStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const term = currentMonth <= 4 ? 1 : currentMonth <= 8 ? 2 : 3;

      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status,
          class_id: selectedClass ? parseInt(selectedClass) : null,
          stream_id: selectedStream ? parseInt(selectedStream) : null,
          marked_by: userData?.id || null,
          academic_year: currentYear,
          term,
        }, {
          onConflict: 'student_id,date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance marked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mark attendance');
    }
  });

  // Bulk mark mutation
  const bulkMutation = useMutation({
    mutationFn: async (records: Array<{ studentId: number; status: AttendanceStatus }>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const term = currentMonth <= 4 ? 1 : currentMonth <= 8 ? 2 : 3;

      const attendanceData = records.map(r => ({
        student_id: r.studentId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        status: r.status,
        class_id: selectedClass ? parseInt(selectedClass) : null,
        stream_id: selectedStream ? parseInt(selectedStream) : null,
        marked_by: userData?.id || null,
        academic_year: currentYear,
        term,
      }));

      const { data, error } = await supabase
        .from('attendance')
        .upsert(attendanceData, { onConflict: 'student_id,date' })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Bulk attendance marked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mark attendance');
    }
  });

  const handleMarkAttendance = (studentId: number, status: AttendanceStatus) => {
    markMutation.mutate({ studentId, status });
  };

  const handleBulkMark = () => {
    if (!selectedClass || !students || students.length === 0) {
      toast.error('Please select a class with students');
      return;
    }

    const records = students.map(s => ({
      studentId: s.id,
      status: bulkStatus
    }));

    bulkMutation.mutate(records);
  };

  const getStudentAttendance = (studentId: number) => {
    return attendanceRecords?.find(a => a.student_id === studentId);
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    if (!option) return <Badge>{status}</Badge>;
    
    return (
      <Badge className={option.color}>
        <span className="mr-1">{option.icon}</span>
        {option.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground">
            Mark and track daily student attendance
          </p>
        </div>
      </div>

      <Tabs defaultValue="mark" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="mark" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance</CardTitle>
              <CardDescription>Mark attendance for students</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.icon} {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleBulkMark}
                      disabled={!selectedClass || !students || students.length === 0}
                    >
                      Mark All
                    </Button>
                  </div>
                </div>
              </div>

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
              ) : !students || students.length === 0 ? (
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const attendance = getStudentAttendance(student.id);
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.admission_number}</TableCell>
                          <TableCell>{student.full_name}</TableCell>
                          <TableCell>
                            {attendance ? getStatusBadge(attendance.status as AttendanceStatus) : (
                              <Badge variant="outline">Not Marked</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  variant={attendance?.status === option.value ? 'default' : 'outline'}
                                  onClick={() => handleMarkAttendance(student.id, option.value as AttendanceStatus)}
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
      </Tabs>
    </div>
  );
};
