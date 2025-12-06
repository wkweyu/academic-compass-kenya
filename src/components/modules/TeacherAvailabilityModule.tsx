import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Calendar, Clock, Save, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

interface DayAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  reason?: string;
}

const TeacherAvailabilityModule = () => {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      loadAvailability(selectedTeacher.id);
    }
  }, [selectedTeacher]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const data = await staffService.getStaff({ staff_category: 'Teaching Staff' });
      setTeachers(data);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailability = async (teacherId: number) => {
    try {
      const data = await staffService.getTeacherAvailability(teacherId);
      
      // Initialize all days with defaults
      const allDays: DayAvailability[] = DAYS_OF_WEEK.map(day => {
        const existing = data.find((d: any) => d.day_of_week === day.value);
        return existing || {
          day_of_week: day.value,
          start_time: '08:00',
          end_time: '17:00',
          is_available: day.value !== 0 && day.value !== 6, // Default: weekdays available
          reason: ''
        };
      });
      
      setAvailability(allDays);
    } catch (error) {
      console.error('Error loading availability:', error);
    }
  };

  const handleDayChange = (dayIndex: number, field: keyof DayAvailability, value: any) => {
    setAvailability(prev => prev.map((day, idx) => 
      idx === dayIndex ? { ...day, [field]: value } : day
    ));
  };

  const handleSave = async () => {
    if (!selectedTeacher) return;
    
    setSaving(true);
    try {
      await staffService.bulkSetAvailability(
        selectedTeacher.id, 
        (selectedTeacher as any).school_id || selectedTeacher.school || 1,
        availability
      );
      toast.success('Availability saved successfully');
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Teacher
            </CardTitle>
            <CardDescription>Choose a teacher to manage availability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTeachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    onClick={() => setSelectedTeacher(teacher)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTeacher?.id === teacher.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{teacher.full_name}</p>
                        <p className="text-sm text-muted-foreground">{teacher.employee_no}</p>
                      </div>
                      {(teacher as any).is_hod && (
                        <Badge variant="secondary">HOD</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Availability Configuration */}
        <Card className="lg:col-span-2">
          {selectedTeacher ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTeacher.full_name}</CardTitle>
                    <CardDescription>
                      Configure weekly availability for scheduling
                    </CardDescription>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DAYS_OF_WEEK.map((day, idx) => {
                    const dayData = availability.find(a => a.day_of_week === day.value);
                    const dayIndex = availability.findIndex(a => a.day_of_week === day.value);
                    
                    if (!dayData || dayIndex === -1) return null;
                    
                    return (
                      <div 
                        key={day.value} 
                        className={`p-4 border rounded-lg ${
                          dayData.is_available ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-medium w-24">{day.label}</span>
                            {dayData.is_available ? (
                              <Badge className="bg-green-100 text-green-800">
                                <Check className="mr-1 h-3 w-3" />
                                Available
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">
                                <AlertCircle className="mr-1 h-3 w-3" />
                                Unavailable
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`available-${day.value}`} className="text-sm">
                              Available
                            </Label>
                            <Switch
                              id={`available-${day.value}`}
                              checked={dayData.is_available}
                              onCheckedChange={(checked) => handleDayChange(dayIndex, 'is_available', checked)}
                            />
                          </div>
                        </div>
                        
                        {dayData.is_available ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Start Time</Label>
                              <Input
                                type="time"
                                value={dayData.start_time}
                                onChange={(e) => handleDayChange(dayIndex, 'start_time', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">End Time</Label>
                              <Input
                                type="time"
                                value={dayData.end_time}
                                onChange={(e) => handleDayChange(dayIndex, 'end_time', e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                            <Input
                              placeholder="e.g., Part-time, Personal, etc."
                              value={dayData.reason || ''}
                              onChange={(e) => handleDayChange(dayIndex, 'reason', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a teacher to configure availability</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeacherAvailabilityModule;
