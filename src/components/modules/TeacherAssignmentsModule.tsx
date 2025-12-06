import { useState, useEffect } from 'react';
import { staffService, TeacherSubjectSpecialization } from '@/services/teacherService';
import { Staff, StaffSubjectAssignment } from '@/types/teacher';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, BookOpen, Users, GraduationCap, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Subject {
  id: number;
  name: string;
  code: string;
}

interface ClassInfo {
  id: number;
  name: string;
  grade_level: number;
}

interface Stream {
  id: number;
  name: string;
  class_assigned_id: number;
}

const TeacherAssignmentsModule = () => {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<Staff | null>(null);
  const [teacherSpecializations, setTeacherSpecializations] = useState<TeacherSubjectSpecialization[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<StaffSubjectAssignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Dialog states
  const [isAddSpecializationOpen, setIsAddSpecializationOpen] = useState(false);
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [newSpecialization, setNewSpecialization] = useState({ subject_id: 0, is_primary: false });
  const [newAssignment, setNewAssignment] = useState({ 
    subject_id: 0, 
    class_id: 0, 
    stream_id: 0, 
    is_class_teacher: false 
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTeacher) {
      loadTeacherDetails(selectedTeacher.id);
    }
  }, [selectedTeacher]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teachersData, subjectsData, classesData, streamsData] = await Promise.all([
        staffService.getStaff({ staff_category: 'Teaching Staff' }),
        supabase.from('subjects').select('id, name, code').order('name'),
        supabase.from('classes').select('id, name, grade_level').order('grade_level'),
        supabase.from('streams').select('id, name, class_assigned_id').order('name')
      ]);

      setTeachers(teachersData);
      setSubjects(subjectsData.data || []);
      setClasses(classesData.data || []);
      setStreams(streamsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTeacherDetails = async (teacherId: number) => {
    try {
      const [specializations, assignments] = await Promise.all([
        staffService.getTeacherSubjectSpecializations(teacherId),
        staffService.getStaffSubjects(teacherId)
      ]);
      setTeacherSpecializations(specializations);
      setTeacherAssignments(assignments);
    } catch (error) {
      console.error('Error loading teacher details:', error);
    }
  };

  const handleAddSpecialization = async () => {
    if (!selectedTeacher || !newSpecialization.subject_id) {
      toast.error('Please select a subject');
      return;
    }

    try {
      await staffService.addTeacherSubjectSpecialization(
        selectedTeacher.id,
        newSpecialization.subject_id,
        newSpecialization.is_primary
      );
      toast.success('Subject specialization added');
      setIsAddSpecializationOpen(false);
      setNewSpecialization({ subject_id: 0, is_primary: false });
      loadTeacherDetails(selectedTeacher.id);
    } catch (error: any) {
      console.error('Error adding specialization:', error);
      toast.error(error.message || 'Failed to add specialization');
    }
  };

  const handleRemoveSpecialization = async (id: number) => {
    try {
      await staffService.removeTeacherSubjectSpecialization(id);
      toast.success('Subject specialization removed');
      if (selectedTeacher) {
        loadTeacherDetails(selectedTeacher.id);
      }
    } catch (error) {
      toast.error('Failed to remove specialization');
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedTeacher || !newAssignment.subject_id || !newAssignment.class_id) {
      toast.error('Please select subject and class');
      return;
    }

    try {
      await staffService.assignStaffToSubject(
        selectedTeacher.id,
        newAssignment.subject_id,
        newAssignment.class_id,
        newAssignment.stream_id || undefined,
        newAssignment.is_class_teacher
      );
      toast.success('Teaching assignment added');
      setIsAddAssignmentOpen(false);
      setNewAssignment({ subject_id: 0, class_id: 0, stream_id: 0, is_class_teacher: false });
      loadTeacherDetails(selectedTeacher.id);
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      toast.error(error.message || 'Failed to add assignment');
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    try {
      await staffService.removeStaffSubject(id);
      toast.success('Teaching assignment removed');
      if (selectedTeacher) {
        loadTeacherDetails(selectedTeacher.id);
      }
    } catch (error) {
      toast.error('Failed to remove assignment');
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableSubjectsForSpecialization = subjects.filter(
    s => !teacherSpecializations.some(ts => ts.subject_id === s.id)
  );

  const availableSubjectsForAssignment = subjects.filter(
    s => teacherSpecializations.some(ts => ts.subject_id === s.id)
  );

  const filteredStreams = streams.filter(s => s.class_assigned_id === newAssignment.class_id);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Teacher List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Teaching Staff
            </CardTitle>
            <CardDescription>Select a teacher to manage assignments</CardDescription>
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
                    <p className="font-medium">{teacher.full_name || `${teacher.first_name} ${teacher.last_name}`}</p>
                    <p className="text-sm text-muted-foreground">{teacher.employee_no} • {teacher.department}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teacher Details */}
        <Card className="lg:col-span-2">
          {selectedTeacher ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTeacher.full_name}</CardTitle>
                    <CardDescription>
                      {selectedTeacher.employee_no} • {selectedTeacher.department} • {selectedTeacher.job_title}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{selectedTeacher.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="specializations" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="specializations">Subject Specializations</TabsTrigger>
                    <TabsTrigger value="assignments">Teaching Assignments</TabsTrigger>
                  </TabsList>

                  {/* Subject Specializations Tab */}
                  <TabsContent value="specializations" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Subjects this teacher is qualified to teach
                      </p>
                      <Dialog open={isAddSpecializationOpen} onOpenChange={setIsAddSpecializationOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Subject
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Subject Specialization</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Subject</Label>
                              <Select
                                value={String(newSpecialization.subject_id)}
                                onValueChange={(v) => setNewSpecialization(prev => ({ ...prev, subject_id: parseInt(v) }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableSubjectsForSpecialization.map(subject => (
                                    <SelectItem key={subject.id} value={String(subject.id)}>
                                      {subject.name} ({subject.code})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="primary"
                                checked={newSpecialization.is_primary}
                                onCheckedChange={(checked) => 
                                  setNewSpecialization(prev => ({ ...prev, is_primary: !!checked }))
                                }
                              />
                              <Label htmlFor="primary">Primary Subject</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddSpecializationOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddSpecialization}>Add Subject</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {teacherSpecializations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No subject specializations added yet</p>
                        <p className="text-sm">Add subjects this teacher can teach</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {teacherSpecializations.map((spec) => (
                          <div 
                            key={spec.id} 
                            className="p-3 border rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium">{spec.subject_name}</p>
                              <p className="text-xs text-muted-foreground">{spec.subject_code}</p>
                              {spec.is_primary_subject && (
                                <Badge variant="secondary" className="mt-1">Primary</Badge>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemoveSpecialization(spec.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Teaching Assignments Tab */}
                  <TabsContent value="assignments" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Classes and subjects currently assigned
                      </p>
                      <Dialog open={isAddAssignmentOpen} onOpenChange={setIsAddAssignmentOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" disabled={teacherSpecializations.length === 0}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Assignment
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Teaching Assignment</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            {availableSubjectsForAssignment.length === 0 && (
                              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-800">
                                  Add subject specializations first before creating assignments.
                                </p>
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
                                  {availableSubjectsForAssignment.map(subject => (
                                    <SelectItem key={subject.id} value={String(subject.id)}>
                                      {subject.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

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
                                      {cls.name} (Grade {cls.grade_level})
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

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="classTeacher"
                                checked={newAssignment.is_class_teacher}
                                onCheckedChange={(checked) => 
                                  setNewAssignment(prev => ({ ...prev, is_class_teacher: !!checked }))
                                }
                              />
                              <Label htmlFor="classTeacher">Assign as Class Teacher</Label>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddAssignmentOpen(false)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleAddAssignment}
                              disabled={!newAssignment.subject_id || !newAssignment.class_id}
                            >
                              Add Assignment
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {teacherAssignments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No teaching assignments yet</p>
                        <p className="text-sm">Assign subjects and classes to this teacher</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Stream</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teacherAssignments.map((assignment) => (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">{assignment.subject_name}</TableCell>
                              <TableCell>{assignment.class_name}</TableCell>
                              <TableCell>{assignment.stream_name || 'All'}</TableCell>
                              <TableCell>
                                {assignment.is_class_teacher ? (
                                  <Badge>Class Teacher</Badge>
                                ) : (
                                  <Badge variant="secondary">Subject Teacher</Badge>
                                )}
                              </TableCell>
                              <TableCell>{assignment.academic_year}</TableCell>
                              <TableCell>
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
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-96">
              <div className="text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a teacher from the list</p>
                <p className="text-sm">to manage their subject specializations and assignments</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TeacherAssignmentsModule;