import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Search, Download, Clock, CheckCircle2, XCircle, AlertCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const ATTENDANCE_STATUSES = [
  { value: 'Present', label: 'Present', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  { value: 'Absent', label: 'Absent', color: 'bg-red-100 text-red-800', icon: XCircle },
  { value: 'Late', label: 'Late', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  { value: 'Half Day', label: 'Half Day', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  { value: 'On Leave', label: 'On Leave', color: 'bg-blue-100 text-blue-800', icon: Users },
];

const LEAVE_TYPES = ['Sick', 'Annual', 'Maternity', 'Study', 'Emergency'];

const StaffAttendanceModule = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [attendance, setAttendance] = useState<Record<number, { status: string; check_in?: string; notes?: string; leave_type?: string }>>({});
  const [existingAttendance, setExistingAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (staff.length > 0) {
      loadAttendanceForDate();
    }
  }, [selectedDate, staff]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getStaff({ status: 'Active' });
      setStaff(data);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForDate = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const data = await staffService.getAttendanceForDate(dateStr);
      setExistingAttendance(data);
      
      // Pre-fill attendance state with existing records
      const attendanceMap: { [key: number]: any } = {};
      data.forEach((record: any) => {
        attendanceMap[record.staff_id] = {
          status: record.status,
          check_in: record.check_in_time,
          notes: record.notes,
          leave_type: record.leave_type
        };
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadMonthlyData = async () => {
    try {
      const data = await staffService.getMonthlyAttendanceSummary(selectedYear, selectedMonth);
      setMonthlyData(data);
    } catch (error) {
      console.error('Error loading monthly data:', error);
      toast.error('Failed to load monthly summary');
    }
  };

  useEffect(() => {
    loadMonthlyData();
  }, [selectedMonth, selectedYear]);

  const handleMarkAttendance = (staffId: number, field: string, value: string) => {
    setAttendance(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value
      }
    }));
  };

  const handleQuickMark = (status: string) => {
    // Mark all visible staff with the same status
    const newAttendance: { [key: number]: any } = {};
    filteredStaff.forEach(member => {
      newAttendance[member.id] = { status };
    });
    setAttendance(prev => ({ ...prev, ...newAttendance }));
    toast.success(`Marked all as ${status}`);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const records = Object.entries(attendance)
        .filter(([_, data]) => data.status)
        .map(([staffId, data]) => ({
          staff_id: parseInt(staffId),
          date: dateStr,
          status: data.status,
          check_in_time: data.check_in,
          notes: data.notes,
          leave_type: data.status === 'On Leave' ? data.leave_type : undefined
        }));
      
      await staffService.bulkMarkAttendance(records);
      toast.success(`Attendance saved for ${records.length} staff members`);
      await loadAttendanceForDate();
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const found = ATTENDANCE_STATUSES.find(s => s.value === status);
    return found?.color || 'bg-gray-100 text-gray-800';
  };

  const attendanceStats = {
    total: staff.length,
    marked: Object.keys(attendance).filter(k => attendance[parseInt(k)]?.status).length,
    present: Object.values(attendance).filter(a => a.status === 'Present').length,
    absent: Object.values(attendance).filter(a => a.status === 'Absent').length,
    late: Object.values(attendance).filter(a => a.status === 'Late').length,
    onLeave: Object.values(attendance).filter(a => a.status === 'On Leave').length,
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Attendance</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          {/* Header with Date and Stats */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Total:</span>
                <Badge variant="outline">{attendanceStats.total}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Marked:</span>
                <Badge variant="secondary">{attendanceStats.marked}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{attendanceStats.present}</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span>{attendanceStats.absent}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span>{attendanceStats.late}</span>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Mark Attendance</CardTitle>
                  <CardDescription>Select attendance status for each staff member</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search staff..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  
                  {/* Quick Mark Buttons */}
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleQuickMark('Present')}>
                      All Present
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading staff...</div>
              ) : (
                <div className="space-y-2">
                  {filteredStaff.map((member) => {
                    const currentAttendance = attendance[member.id] || {};
                    return (
                      <div 
                        key={member.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors ${
                          currentAttendance.status ? 'border-primary/20 bg-accent/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">
                              {member.full_name || `${member.first_name} ${member.last_name}`}
                            </h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.employee_no} • {member.job_title} • {member.department}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Check-in Time */}
                          <Input
                            type="time"
                            value={currentAttendance.check_in || ''}
                            onChange={(e) => handleMarkAttendance(member.id, 'check_in', e.target.value)}
                            className="w-28"
                            placeholder="Check-in"
                          />
                          
                          {/* Status Selection */}
                          <Select
                            value={currentAttendance.status || ''}
                            onValueChange={(value) => handleMarkAttendance(member.id, 'status', value)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {ATTENDANCE_STATUSES.map(status => (
                                <SelectItem key={status.value} value={status.value}>
                                  <div className="flex items-center gap-2">
                                    <status.icon className="h-4 w-4" />
                                    {status.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Leave Type (only if On Leave) */}
                          {currentAttendance.status === 'On Leave' && (
                            <Select
                              value={currentAttendance.leave_type || ''}
                              onValueChange={(value) => handleMarkAttendance(member.id, 'leave_type', value)}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAVE_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {/* Status Badge */}
                          {currentAttendance.status && (
                            <Badge className={getStatusColor(currentAttendance.status)}>
                              {currentAttendance.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Save Button */}
              {Object.keys(attendance).some(k => attendance[parseInt(k)]?.status) && (
                <div className="mt-6 flex justify-between items-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {attendanceStats.marked} of {attendanceStats.total} staff marked
                  </p>
                  <Button onClick={handleSaveAttendance} disabled={saving} size="lg">
                    {saving ? 'Saving...' : `Save Attendance`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monthly Attendance Summary</CardTitle>
                  <CardDescription>View attendance patterns for all staff</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {format(new Date(2024, i, 1), 'MMMM')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2023, 2024, 2025].map(year => (
                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Late</TableHead>
                    <TableHead className="text-center">On Leave</TableHead>
                    <TableHead className="text-center">Total Days</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No attendance data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyData.map((row) => {
                      const rate = row.total > 0 ? Math.round((row.present / row.total) * 100) : 0;
                      return (
                        <TableRow key={row.staff_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.staff_name}</p>
                              <p className="text-sm text-muted-foreground">{row.employee_no}</p>
                            </div>
                          </TableCell>
                          <TableCell>{row.department}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-100 text-green-800">{row.present}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-red-100 text-red-800">{row.absent}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-yellow-100 text-yellow-800">{row.late}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-800">{row.on_leave}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{row.total}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={rate >= 90 ? 'default' : rate >= 75 ? 'secondary' : 'destructive'}>
                              {rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StaffAttendanceModule;