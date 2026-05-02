import { useState, useEffect } from 'react';
import { staffService } from '@/services/teacherService';
import { Staff } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, Plus, Trash2, Clock, AlertTriangle, Settings, BookOpen 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WorkloadAssignment {
  id: number;
  teacher_id: number;
  class_id: number;
  stream_id?: number;
  subject_id: number;
  lessons_per_week: number;
  is_class_teacher: boolean;
  class?: { id: number; name: string };
  stream?: { id: number; name: string };
  subject?: { id: number; name: string };
}

interface ClassInfo {
  id: number;
  name: string;
  grade_level: number;
}

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface Stream {
  id: number;
  name: string;
  class_assigned_id: number;
}

const TeacherWorkloadModule = () => {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null);
  const [workload, setWorkload] = useState<{
    assignments: WorkloadAssignment[];
    total_lessons: number;
    weekly_limit: number;
    is_overloaded: boolean;
    workload_percentage: number;
  } | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    class_id: 0,
    stream_id: 0,
    subject_id: 0,
    lessons_per_week: 5,
    is_class_teacher: false
  });
  const [weeklyLimit, setWeeklyLimit] = useState(28);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      loadWorkload(selectedTeacher.id);
      setWeeklyLimit((selectedTeacher as any).weekly_workload_limit || 28);
    }
  }, [selectedTeacher]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teachersData, classesData, subjectsData, streamsData] = await Promise.all([
        staffService.getStaff({ staff_category: 'Teaching Staff' }),
        supabase.from('classes').select('id, name, grade_level').order('grade_level'),
        supabase.from('subjects').select('id, name, code').order('name'),
        supabase.from('streams').select('id, name, class_assigned_id').order('name')
      ]);

      setTeachers(teachersData);
      setClasses(classesData.data || []);
      setSubjects(subjectsData.data || []);
      setStreams(streamsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkload = async (teacherId: number) => {
    try {
      const data = await staffService.getDetailedWorkload(teacherId);
      setWorkload(data);
    } catch (error) {
      console.error('Error loading workload:', error);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedTeacher || !newAssignment.class_id || !newAssignment.subject_id) {
      toast.error('Please select class and subject');
      return;
    }

    try {
      await staffService.addWorkloadAssignment({
        teacher_id: selectedTeacher.id,
        class_id: newAssignment.class_id,
        stream_id: newAssignment.stream_id || undefined,
        subject_id: newAssignment.subject_id,
        lessons_per_week: newAssignment.lessons_per_week,
        is_class_teacher: newAssignment.is_class_teacher,
        school_id: (selectedTeacher as any).school_id || selectedTeacher.school || 1
      });
      
      toast.success('Assignment added');
      setIsAddOpen(false);
      setNewAssignment({ class_id: 0, stream_id: 0, subject_id: 0, lessons_per_week: 5, is_class_teacher: false });
      loadWorkload(selectedTeacher.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add assignment');
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    try {
      await staffService.removeWorkloadAssignment(id);
      toast.success('Assignment removed');
      if (selectedTeacher) {
        loadWorkload(selectedTeacher.id);
      }
    } catch (error) {
      toast.error('Failed to remove assignment');
    }
  };

  const handleUpdateLimit = async () => {
    if (!selectedTeacher) return;
    
    try {
      await staffService.updateWorkloadLimit(selectedTeacher.id, weeklyLimit);
      toast.success('Workload limit updated');
      setIsSettingsOpen(false);
      loadWorkload(selectedTeacher.id);
    } catch (error) {
      toast.error('Failed to update limit');
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStreams = streams.filter(s => s.class_assigned_id === newAssignment.class_id);

  const getWorkloadColor = (percentage: number) => {
    if (percentage <= 70) return 'bg-green-500';
    if (percentage <= 90) return 'bg-yellow-500';
    if (percentage <= 100) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Teachers
            </CardTitle>
            <CardDescription>Select to manage workload</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredTeachers.map((teacher) => {
                  const currentWorkload = (teacher as any).current_workload || 0;
                  const limit = (teacher as any).weekly_workload_limit || 28;
                  const isOverloaded = currentWorkload > limit;
                  
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => setSelectedTeacher(teacher)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTeacher?.id === teacher.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{teacher.full_name}</p>
                        {isOverloaded && <AlertTriangle className="h-4 w-4 text-red-600" />}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={Math.min((currentWorkload / limit) * 100, 100)} 
                          className="h-2 flex-1"
                        />
                        <span className={`text-xs ${isOverloaded ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {currentWorkload}/{limit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workload Details */}
        <Card className="lg:col-span-2">
          {selectedTeacher && workload ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTeacher.full_name}</CardTitle>
                    <CardDescription>
                      {workload.total_lessons} of {workload.weekly_limit} lessons/week
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Workload Settings</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Weekly Lesson Limit</Label>
                            <Input
                              type="number"
                              value={weeklyLimit}
                              onChange={(e) => setWeeklyLimit(parseInt(e.target.value) || 28)}
                              min={1}
                              max={50}
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum lessons per week before workload warning
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                          <Button onClick={handleUpdateLimit}>Save</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Assignment
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Workload Assignment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Class</Label>
                            <Select
                              value={String(newAssignment.class_id)}
                              onValueChange={(v) => setNewAssignment(prev => ({ 
                                ...prev, 
                                class_id: parseInt(v),
                                stream_id: 0
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select class" />
                              </SelectTrigger>
                              <SelectContent>
                                {classes.map(cls => (
                                  <SelectItem key={cls.id} value={String(cls.id)}>
                                    {cls.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {filteredStreams.length > 0 && (
                            <div className="space-y-2">
                              <Label>Stream (Optional)</Label>
                              <Select
                                value={String(newAssignment.stream_id)}
                                onValueChange={(v) => setNewAssignment(prev => ({ ...prev, stream_id: parseInt(v) }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="All streams" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">All Streams</SelectItem>
                                  {filteredStreams.map(stream => (
                                    <SelectItem key={stream.id} value={String(stream.id)}>
                                      {stream.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Select
                              value={String(newAssignment.subject_id)}
                              onValueChange={(v) => setNewAssignment(prev => ({ ...prev, subject_id: parseInt(v) }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map(subject => (
                                  <SelectItem key={subject.id} value={String(subject.id)}>
                                    {subject.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Lessons per Week</Label>
                            <Input
                              type="number"
                              value={newAssignment.lessons_per_week}
                              onChange={(e) => setNewAssignment(prev => ({ 
                                ...prev, 
                                lessons_per_week: parseInt(e.target.value) || 1
                              }))}
                              min={1}
                              max={15}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                          <Button onClick={handleAddAssignment}>Add</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Workload Progress */}
                <div className="mb-6 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Weekly Workload</span>
                    <span className={workload.is_overloaded ? 'text-red-600 font-bold' : ''}>
                      {workload.total_lessons} / {workload.weekly_limit} lessons
                      {workload.is_overloaded && ' (OVERLOADED)'}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(workload.workload_percentage, 100)} 
                    className={workload.is_overloaded ? 'bg-red-100' : ''}
                  />
                </div>

                {/* Assignments Table */}
                {workload.assignments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Class</TableHead>
                        <TableHead>Stream</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-center">Lessons/Week</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workload.assignments.map((assignment: any) => (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.class?.name || `Class ${assignment.class_id}`}</TableCell>
                          <TableCell>{assignment.stream?.name || '-'}</TableCell>
                          <TableCell>{assignment.subject?.name || `Subject ${assignment.subject_id}`}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{assignment.lessons_per_week}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAssignment(assignment.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No workload assignments yet</p>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a teacher to manage workload</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeacherWorkloadModule;
