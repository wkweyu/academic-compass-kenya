import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  time_in?: string;
  notes?: string;
  students: {
    full_name: string;
  } | null;
}

export function AttendanceDatasheet() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStream, setSelectedStream] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);

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

  // Fetch streams
  const { data: streams = [] } = useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const fetchAttendance = async () => {
    if (!selectedClass || !startDate || !endDate) {
      toast.error('Please select class and date range');
      return;
    }
    
    setIsLoadingAttendance(true);
    try {
      let query = supabase
        .from('attendance')
        .select(`
          id,
          date,
          status,
          time_in,
          notes,
          students!inner (
            full_name
          )
        `)
        .eq('class_id', selectedClass)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (selectedStream) {
        query = query.eq('stream_id', selectedStream);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Attendance fetch error:', error);
        toast.error(`Failed to load attendance: ${error.message}`);
        return;
      }

      // Transform data to match our interface
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        students: Array.isArray(item.students) ? item.students[0] : item.students
      }));

      setAttendanceData(transformedData);
      toast.success(`Loaded ${data?.length || 0} attendance records`);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="Weekly Attendance Datasheet" />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStream} onValueChange={setSelectedStream}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Streams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Streams</SelectItem>
                {streams.map((s: any) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[180px]"
              placeholder="Start Date"
            />

            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[180px]"
              placeholder="End Date"
            />

            <Button 
              onClick={fetchAttendance}
              disabled={isLoadingAttendance}
            >
              {isLoadingAttendance ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Attendance'
              )}
            </Button>
          </div>

          {attendanceData.length > 0 ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.students?.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {new Date(record.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          record.status.toLowerCase() === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                          record.status.toLowerCase() === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                          record.status.toLowerCase() === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        }`}>
                          {record.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>{record.time_in || '-'}</TableCell>
                      <TableCell>{record.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {selectedClass && startDate && endDate 
                ? 'Click "Load Attendance" to view records'
                : 'Select class and date range, then click "Load Attendance"'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
