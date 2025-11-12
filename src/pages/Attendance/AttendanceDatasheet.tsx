import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classService } from "@/services/classService";
import { showError } from "@/utils/errorHandler";
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

export function AttendanceDatasheet() {
  const [data, setData] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStream, setSelectedStream] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchClasses();
    fetchStreams();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await classService.getClasses();
      setClasses(data);
    } catch (error) {
      showError(error, 'Failed to load classes');
    }
  };

  const fetchStreams = async () => {
    try {
      const data = await classService.getStreams();
      setStreams(data);
    } catch (error) {
      showError(error, 'Failed to load streams');
    }
  };

  const fetchDatasheet = async () => {
    if (!selectedClass || !startDate || !endDate) return;
    
    try {
      const { data: schoolId } = await supabase.rpc('get_user_school_id');
      
      if (!schoolId) {
        showError('No school found for user', 'Fetch attendance');
        return;
      }

      let query = supabase
        .from('attendance')
        .select(`
          *,
          students!inner (
            id,
            full_name
          )
        `)
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .order('students(full_name)', { ascending: true });

      if (selectedStream) {
        query = query.eq('stream_id', selectedStream);
      }

      const { data: attendanceData, error } = await query;
      
      if (error) {
        showError(error, 'Failed to load attendance data');
        return;
      }

      setData(attendanceData || []);
    } catch (err) {
      showError(err, 'Fetch attendance datasheet');
    }
  };

  useEffect(() => {
    if (selectedClass && startDate && endDate) {
      fetchDatasheet();
    }
  }, [selectedClass, selectedStream, startDate, endDate]);

  return (
    <div>
      <PageHeader title="Weekly Attendance Datasheet" />
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4">
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
                <SelectValue placeholder="Select Stream" />
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
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[180px]"
            />
            <Button onClick={fetchDatasheet}>Filter</Button>
          </div>
          {data && data.length > 0 ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Student Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {record.students?.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'absent' ? 'bg-red-100 text-red-800' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {record.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
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
                ? 'No attendance records found for the selected criteria'
                : 'Please select class and date range to view attendance data'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
