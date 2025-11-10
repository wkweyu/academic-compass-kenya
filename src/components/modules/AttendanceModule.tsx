import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Check, X, Clock, UserCheck, Save, FileClock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface AttendanceRecord {
  student_id: number;
  student_name: string;
  admission_number: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  time_in?: string;
  notes?: string;
  reason?: string;
}

export function AttendanceModule() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Record<number, AttendanceRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Fetch classes
  const { data: classes = [], isLoading } = useQuery({
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
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      let query = supabase
        .from('students')
        .select('id, full_name, admission_number, current_class_id, current_stream_id')
        .eq('current_class_id', selectedClass)
        .eq('is_active', true)
        .order('full_name');

      if (selectedStream && selectedStream !== 'all') {
        query = query.eq('current_stream_id', selectedStream);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass
  });

  // Fetch existing attendance for selected date/class/stream
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', selectedDate, selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return [];
      
      let query = supabase
        .from('attendance')
        .select('*')
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .eq('class_id', selectedClass);

      if (selectedStream && selectedStream !== 'all') {
        query = query.eq('stream_id', selectedStream);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClass
  });

  // Initialize attendance records when students or existing attendance changes
  useEffect(() => {
    if (students.length > 0) {
      const records: Record<number, AttendanceRecord> = {};
      students.forEach((student: any) => {
        const existing = existingAttendance.find((a: any) => a.student_id === student.id);
        records[student.id] = {
          student_id: student.id,
          student_name: student.full_name,
          admission_number: student.admission_number,
          status: existing?.status || 'Present',
          time_in: existing?.time_in || format(new Date(), 'HH:mm'),
          notes: existing?.notes || '',
          reason: existing?.reason || ''
        };
      });
      setAttendanceRecords(records);
    }
  }, [students, existingAttendance]);

  const updateStatus = (studentId: number, status: 'Present' | 'Absent' | 'Late' | 'Excused') => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const updateField = (studentId: number, field: 'time_in' | 'notes' | 'reason', value: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const markAllPresent = () => {
    const updated = { ...attendanceRecords };
    Object.keys(updated).forEach(key => {
      updated[parseInt(key)].status = 'Present';
    });
    setAttendanceRecords(updated);
  };

  const markAllAbsent = () => {
    const updated = { ...attendanceRecords };
    Object.keys(updated).forEach(key => {
      updated[parseInt(key)].status = 'Absent';
    });
    setAttendanceRecords(updated);
  };

  const saveAttendance = async () => {
    if (!selectedClass) {
      toast.error('Please select a class');
      return;
    }

    setIsSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // First, delete existing attendance records for the affected students on this date
      const studentIds = Object.keys(attendanceRecords).map(id => parseInt(id));
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .in('student_id', studentIds)
        .eq('date', dateStr);
      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      // Then insert new records
      const records = Object.values(attendanceRecords).map(record => ({
        student_id: record.student_id,
        class_id: parseInt(selectedClass),
        stream_id: selectedStream && selectedStream !== 'all' ? parseInt(selectedStream) : null,
        date: dateStr,
        status: record.status.toLowerCase(),
        time_in: record.time_in || null,
        notes: record.notes || null,
        reason: record.reason || null,
        term: 1,
        academic_year: new Date().getFullYear()
      }));

      const { error: insertError } = await supabase
        .from('attendance')
        .insert(records);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      toast.success('Attendance saved successfully');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast.error(error?.message || 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const stats = {
    total: Object.keys(attendanceRecords).length,
    present: Object.values(attendanceRecords).filter(r => r.status === 'Present').length,
    absent: Object.values(attendanceRecords).filter(r => r.status === 'Absent').length,
    late: Object.values(attendanceRecords).filter(r => r.status === 'Late').length,
    excused: Object.values(attendanceRecords).filter(r => r.status === 'Excused').length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Attendance Management</h1>
        <div className="flex gap-2">
          {selectedClass && students.length > 0 && (
            <Button onClick={saveAttendance} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Attendance'}
            </Button>
          )}
          <Link to="/attendance/reports">
            <Button variant="outline">
              <FileClock className="mr-2 h-4 w-4" />
              View Reports
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Date and Class</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
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

              <div>
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={(value) => {
                  setSelectedClass(value);
                  setSelectedStream('');
                }}>
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

              {selectedClass && streams.length > 0 && (
                <div>
                  <Label>Stream</Label>
                  <Select value={selectedStream} onValueChange={setSelectedStream}>
                    <SelectTrigger>
                      <SelectValue placeholder="All streams" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Streams</SelectItem>
                      {streams.map((stream: any) => (
                        <SelectItem key={stream.id} value={stream.id.toString()}>
                          {stream.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClass && stats.total > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                <p className="text-xs text-muted-foreground">Present</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
                <p className="text-xs text-muted-foreground">Absent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
                <p className="text-xs text-muted-foreground">Late</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{stats.excused}</div>
                <p className="text-xs text-muted-foreground">Excused</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Mark Attendance</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={markAllPresent}>
                    Mark All Present
                  </Button>
                  <Button size="sm" variant="outline" onClick={markAllAbsent}>
                    Mark All Absent
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingStudents ? (
                <div className="text-center py-8">Loading students...</div>
              ) : (
                <div className="space-y-4">
                  {students.map((student: any) => {
                    const record = attendanceRecords[student.id];
                    if (!record) return null;

                    return (
                      <div key={student.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <p className="font-medium">{student.full_name}</p>
                            <p className="text-sm text-muted-foreground">{student.admission_number}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant={record.status === 'Present' ? 'default' : 'outline'}
                              onClick={() => updateStatus(student.id, 'Present')}
                              className={record.status === 'Present' ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Present
                            </Button>
                            <Button
                              size="sm"
                              variant={record.status === 'Absent' ? 'default' : 'outline'}
                              onClick={() => updateStatus(student.id, 'Absent')}
                              className={record.status === 'Absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Absent
                            </Button>
                            <Button
                              size="sm"
                              variant={record.status === 'Late' ? 'default' : 'outline'}
                              onClick={() => updateStatus(student.id, 'Late')}
                              className={record.status === 'Late' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Late
                            </Button>
                            <Button
                              size="sm"
                              variant={record.status === 'Excused' ? 'default' : 'outline'}
                              onClick={() => updateStatus(student.id, 'Excused')}
                              className={record.status === 'Excused' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Excused
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Time In</Label>
                            <Input
                              type="time"
                              value={record.time_in}
                              onChange={(e) => updateField(student.id, 'time_in', e.target.value)}
                              disabled={record.status === 'Absent'}
                            />
                          </div>
                          {record.status !== 'Present' && (
                            <>
                              <div>
                                <Label className="text-xs">Reason</Label>
                                <Input
                                  placeholder="Enter reason"
                                  value={record.reason}
                                  onChange={(e) => updateField(student.id, 'reason', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Notes</Label>
                                <Input
                                  placeholder="Additional notes"
                                  value={record.notes}
                                  onChange={(e) => updateField(student.id, 'notes', e.target.value)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
