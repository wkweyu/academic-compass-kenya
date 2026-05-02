import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Download } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Papa from 'papaparse';

export function AttendanceReportsModule() {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | undefined>();

  const queryClient = useQueryClient();

  const generateReport = async () => {
    if (!startDate || !endDate || !selectedClass) {
      toast.error('Please select start date, end date, and class.');
      return;
    }

    setIsGenerating(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          date,
          status,
          time_in,
          notes,
          reason,
          students (full_name, admission_number),
          classes (name),
          streams (name)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .eq('class_id', selectedClass);

      if (selectedStream && selectedStream !== 'all') {
        query = query.eq('stream_id', selectedStream);
      }

      if (selectedStudent && selectedStudent !== 'all') {
        query = query.eq('student_id', selectedStudent);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReportData(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

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
  const { data: students = [] } = useQuery({
    queryKey: ['students', selectedClass, selectedStream],
    queryFn: async () => {
      if (!selectedClass) return [];
      let query = supabase
        .from('students')
        .select('id, full_name')
        .eq('current_class_id', selectedClass)
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

  const generateWeeklyReport = async () => {
    if (!selectedWeekStart || !selectedClass) {
      toast.error('Please select a week and class');
      return;
    }

    setIsGenerating(true);
    try {
      const weekEnd = endOfWeek(selectedWeekStart, { weekStartsOn: 1 }); // Monday start
      const weekDays = eachDayOfInterval({ start: selectedWeekStart, end: weekEnd });

      // Fetch all students in the class/stream
      let studentQuery = supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('current_class_id', selectedClass)
        .order('full_name');

      if (selectedStream && selectedStream !== 'all') {
        studentQuery = studentQuery.eq('current_stream_id', selectedStream);
      }

      const { data: students, error: studentsError } = await studentQuery;
      if (studentsError) throw studentsError;

      // Fetch attendance for the week
      if (!students || students.length === 0) {
        setWeeklyData([]);
        toast.info("No students found for this class and stream.");
        setIsGenerating(false);
        return;
      }
      const studentIds = students.map(s => s.id);
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('student_id, date, status')
        .in('student_id', studentIds)
        .gte('date', format(selectedWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'));

      if (attendanceError) throw attendanceError;

      // Create attendance map
      const attendanceMap = new Map();
      attendance?.forEach(record => {
        const key = `${record.student_id}-${record.date}`;
        attendanceMap.set(key, record.status);
      });

      // Build weekly grid data
      const weeklyGrid = students?.map(student => {
        const row: any = {
          id: student.id,
          name: student.full_name,
          admission_number: student.admission_number,
          days: {}
        };

        weekDays.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const key = `${student.id}-${dateStr}`;
          row.days[dateStr] = attendanceMap.get(key) || '-';
        });

        return row;
      });

      setWeeklyData(weeklyGrid || []);
      toast.success('Weekly report generated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate weekly report');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToCsv = () => {
    if (reportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const csvData = reportData.map(record => ({
      'Student Name': record.students.full_name,
      'Admission Number': record.students.admission_number,
      'Date': format(new Date(record.date), 'yyyy-MM-dd'),
      'Status': record.status,
      'Time In': record.time_in,
      'Reason': record.reason,
      'Notes': record.notes
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'attendance_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Attendance Reports</h1>
      
      <Tabs defaultValue="detailed" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detailed">Detailed Report</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Grid</TabsTrigger>
        </TabsList>

        <TabsContent value="detailed" className="space-y-4">
          <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>End Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
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
          {selectedClass && (
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
          {selectedClass && (
            <div>
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {students.map((student: any) => (
                    <SelectItem key={student.id} value={student.id.toString()}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button onClick={generateReport} disabled={isGenerating}>
          <Download className="mr-2 h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate Report'}
        </Button>
        <Button variant="outline" onClick={exportToCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time In</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((record, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.students.full_name}</div>
                      <div className="text-sm text-gray-500">{record.students.admission_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(record.date), 'PPP')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        record.status === 'absent' ? 'bg-red-100 text-red-800' :
                        record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.time_in}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Filters</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Select Week (Monday)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedWeekStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedWeekStart ? format(selectedWeekStart, 'PPP') : 'Pick week start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedWeekStart}
                      onSelect={(date) => {
                        if (date) {
                          const monday = startOfWeek(date, { weekStartsOn: 1 });
                          setSelectedWeekStart(monday);
                        }
                      }}
                      initialFocus
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
              {selectedClass && (
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={generateWeeklyReport} disabled={isGenerating}>
              <Download className="mr-2 h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Generate Weekly Report'}
            </Button>
          </div>

          {weeklyData.length > 0 && selectedWeekStart && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Weekly Attendance: {format(selectedWeekStart, 'MMM d')} - {format(endOfWeek(selectedWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Student</th>
                        {eachDayOfInterval({
                          start: selectedWeekStart,
                          end: endOfWeek(selectedWeekStart, { weekStartsOn: 1 })
                        }).map(day => (
                          <th key={day.toString()} className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                            <div>{format(day, 'EEE')}</div>
                            <div className="text-muted-foreground">{format(day, 'MMM d')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-card divide-y divide-border">
                      {weeklyData.map((student) => (
                        <tr key={student.id}>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium">{student.name}</div>
                            <div className="text-xs text-muted-foreground">{student.admission_number}</div>
                          </td>
                          {Object.entries(student.days).map(([date, status]: [string, any]) => (
                            <td key={date} className="px-4 py-4 text-center">
                              {status === '-' ? (
                                <span className="text-muted-foreground">-</span>
                              ) : (
                                <span className={`inline-flex items-center justify-center w-8 h-8 text-xs font-semibold rounded-full ${
                                  status?.toLowerCase() === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                                  status?.toLowerCase() === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                                  status?.toLowerCase() === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                                }`}>
                                  {status?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
