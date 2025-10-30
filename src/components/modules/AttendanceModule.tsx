import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Save, Users, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface Student {
  id: number;
  full_name: string;
  admission_number: string;
  current_class_id: number;
  current_stream_id: number;
}

interface AttendanceRecord {
  id?: string;
  student_id: number;
  class_id: number;
  stream_id: number | null;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  time_in?: string;
  notes?: string;
  term: number;
  academic_year: number;
  marked_by?: number;
}

export function AttendanceModule() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<Record<number, AttendanceRecord>>({});
  const [currentTerm, setCurrentTerm] = useState(2);
  const [currentYear, setCurrentYear] = useState(2024);
  const [userId, setUserId] = useState<number | null>(null);

  // Get current user ID
  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();
        if (data) setUserId(data.id);
      }
    };
    fetchUserId();
  }, []);

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('grade_level');
      if (error) throw error;
      return data;
    }
  });

  // Fetch streams for selected class
  const { data: streams = [] } = useQuery({
    queryKey: ['streams', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('class_assigned_id', selectedClass)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass
  });

  // Fetch students for selected class/stream
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students', selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return [];
      let query = supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id, current_stream_id')
        .eq('current_class_id', selectedClass)
        .eq('is_active', true)
        .order('full_name');
      
      if (selectedStream) {
        query = query.eq('current_stream_id', selectedStream);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Student[];
    },
    enabled: !!selectedClass
  });

  // Fetch existing attendance for selected date/class/stream
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', format(selectedDate, 'yyyy-MM-dd'), selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return [];
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .eq('class_id', selectedClass);
      
      if (selectedStream) {
        query = query.eq('stream_id', selectedStream);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AttendanceRecord[];
    },
    enabled: !!selectedClass
  });

  // Initialize attendance data from existing records
  useEffect(() => {
    if (students.length > 0) {
      const initialData: Record<number, AttendanceRecord> = {};
      students.forEach(student => {
        const existing = existingAttendance.find(a => a.student_id === student.id);
        initialData[student.id] = existing || {
          student_id: student.id,
          class_id: parseInt(selectedClass),
          stream_id: selectedStream ? parseInt(selectedStream) : null,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status: 'Present',
          term: currentTerm,
          academic_year: currentYear
        };
      });
      setAttendanceData(initialData);
    }
  }, [students, existingAttendance, selectedDate, selectedClass, selectedStream]);

  // Save attendance mutation
  const saveMutation = useMutation({
    mutationFn: async (records: AttendanceRecord[]) => {
      const recordsWithUser = records.map(r => ({
        ...r,
        marked_by: userId
      }));
      
      const { error } = await supabase
        .from('attendance')
        .upsert(recordsWithUser, {
          onConflict: 'student_id,date'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({
        title: 'Success',
        description: 'Attendance saved successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to save attendance: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const updateStudentStatus = (studentId: number, status: AttendanceRecord['status']) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status
      }
    }));
  };

  const updateStudentNotes = (studentId: number, notes: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes
      }
    }));
  };

  const markAllAs = (status: AttendanceRecord['status']) => {
    const updated = { ...attendanceData };
    Object.keys(updated).forEach(key => {
      updated[parseInt(key)].status = status;
    });
    setAttendanceData(updated);
  };

  const handleSave = () => {
    const records = Object.values(attendanceData);
    saveMutation.mutate(records);
  };

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'Present': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'Absent': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'Late': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'Excused': return <AlertCircle className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    const variants: Record<AttendanceRecord['status'], string> = {
      Present: 'bg-green-100 text-green-800',
      Absent: 'bg-red-100 text-red-800',
      Late: 'bg-orange-100 text-orange-800',
      Excused: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={variants[status]}>{status}</Badge>;
  };

  const stats = {
    total: students.length,
    present: Object.values(attendanceData).filter(a => a.status === 'Present').length,
    absent: Object.values(attendanceData).filter(a => a.status === 'Absent').length,
    late: Object.values(attendanceData).filter(a => a.status === 'Late').length,
    excused: Object.values(attendanceData).filter(a => a.status === 'Excused').length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Date and Class</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls: any) => (
                    <SelectItem key={cls.id} value={cls.id.toString()}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Stream (Optional)</Label>
              <Select value={selectedStream} onValueChange={setSelectedStream}>
                <SelectTrigger>
                  <SelectValue placeholder="All streams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Streams</SelectItem>
                  {streams.map((stream: any) => (
                    <SelectItem key={stream.id} value={stream.id.toString()}>
                      {stream.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total Students</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                <div className="text-sm text-muted-foreground">Present</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                <div className="text-sm text-muted-foreground">Absent</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">{stats.late}</div>
                <div className="text-sm text-muted-foreground">Late</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{stats.excused}</div>
                <div className="text-sm text-muted-foreground">Excused</div>
              </CardContent>
            </Card>
          </div>

          {/* Bulk Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => markAllAs('Present')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark All Present
              </Button>
              <Button variant="outline" onClick={() => markAllAs('Absent')}>
                <XCircle className="mr-2 h-4 w-4" />
                Mark All Absent
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
              </Button>
            </CardContent>
          </Card>

          {/* Student List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Student Attendance ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {studentsLoading ? (
                <div className="text-center py-8">Loading students...</div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No students found for this class/stream
                </div>
              ) : (
                <div className="space-y-4">
                  {students.map((student) => (
                    <div key={student.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-medium">{student.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Adm No: {student.admission_number}
                          </div>
                        </div>
                        {attendanceData[student.id] && getStatusBadge(attendanceData[student.id].status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        {(['Present', 'Absent', 'Late', 'Excused'] as const).map((status) => (
                          <Button
                            key={status}
                            variant={attendanceData[student.id]?.status === status ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateStudentStatus(student.id, status)}
                            className="w-full"
                          >
                            {getStatusIcon(status)}
                            <span className="ml-2">{status}</span>
                          </Button>
                        ))}
                      </div>

                      {attendanceData[student.id]?.status !== 'Present' && (
                        <div>
                          <Label className="text-xs">Notes/Reason</Label>
                          <Input
                            placeholder="Add notes..."
                            value={attendanceData[student.id]?.notes || ''}
                            onChange={(e) => updateStudentNotes(student.id, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
