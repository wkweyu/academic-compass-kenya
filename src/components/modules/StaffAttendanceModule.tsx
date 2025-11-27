import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Search, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const StaffAttendanceModule = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [attendance, setAttendance] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const data = await staffService.getStaff({ status: 'Active' });
      setStaff(data);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff');
    }
  };

  const handleMarkAttendance = async (staffId: number, status: string) => {
    setAttendance(prev => ({ ...prev, [staffId]: status }));
  };

  const handleSaveAttendance = async () => {
    setLoading(true);
    try {
      const promises = Object.entries(attendance).map(([staffId, status]) => 
        staffService.markStaffAttendance({
          staff_id: parseInt(staffId),
          date: format(selectedDate, 'yyyy-MM-dd'),
          status,
        })
      );
      
      await Promise.all(promises);
      toast.success('Attendance marked successfully');
      setAttendance({});
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.employee_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Absent': return 'bg-red-100 text-red-800';
      case 'Late': return 'bg-yellow-100 text-yellow-800';
      case 'Half Day': return 'bg-orange-100 text-orange-800';
      case 'On Leave': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Staff Attendance</h2>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
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
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mark Attendance</CardTitle>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredStaff.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50">
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="font-medium">{member.full_name || `${member.first_name} ${member.last_name}`}</h4>
                    <p className="text-sm text-muted-foreground">{member.employee_no} - {member.job_title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={attendance[member.id] || ''}
                    onValueChange={(value) => handleMarkAttendance(member.id, value)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Mark status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                      <SelectItem value="Half Day">Half Day</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                  {attendance[member.id] && (
                    <Badge className={getStatusColor(attendance[member.id])}>
                      {attendance[member.id]}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {Object.keys(attendance).length > 0 && (
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSaveAttendance} disabled={loading}>
                {loading ? 'Saving...' : `Save Attendance (${Object.keys(attendance).length})`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffAttendanceModule;