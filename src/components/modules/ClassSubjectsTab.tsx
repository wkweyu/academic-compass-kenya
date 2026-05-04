import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, Users, Trash2, Edit, CheckCircle, XCircle, GraduationCap, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { classSubjectService } from '@/services/classSubjectService';
import { subjectService } from '@/services/subjectService';
import { ClassSubject, SubjectGroup, ClassSubjectFormData, SubjectGroupFormData } from '@/types/class-subject';
import { Subject } from '@/types/subject';
import { supabase } from '@/integrations/supabase/client';

interface ClassSubjectsTabProps {
  classes: { id: string | number; name: string; grade_level: number }[];
  teachers: { id: number; first_name: string; last_name: string; employee_no: string }[];
}

export const ClassSubjectsTab = ({ classes, teachers }: ClassSubjectsTabProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<number, number>>({});
  
  // Dialog states
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isAllocateStudentsOpen, setIsAllocateStudentsOpen] = useState(false);
  const [isViewStudentsOpen, setIsViewStudentsOpen] = useState(false);
  const [selectedClassSubject, setSelectedClassSubject] = useState<ClassSubject | null>(null);
  const [allocatedStudentsList, setAllocatedStudentsList] = useState<any[]>([]);
  const [loadingStudentsList, setLoadingStudentsList] = useState(false);
  
  // Form states
  const [subjectForm, setSubjectForm] = useState<ClassSubjectFormData>({
    subject_id: 0,
    teacher_id: null,
    is_examinable: true,
    is_compulsory: true,
    periods_per_week: 3,
    subject_group_id: null,
    is_double: false,
    priority: 0,
    requires_special_room: false,
    preferred_room_type: null
  });
  
  const [groupForm, setGroupForm] = useState<SubjectGroupFormData>({
    name: '',
    description: '',
    min_subjects: 1,
    max_subjects: 2
  });

  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  useEffect(() => {
    loadAvailableSubjects();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadClassSubjects();
      loadSubjectGroups();
      loadStudentsInClass();
      loadStudentCounts();
    } else {
      setClassSubjects([]);
      setSubjectGroups([]);
      setStudents([]);
      setStudentCounts({});
    }
  }, [selectedClassId]);

  const loadAvailableSubjects = async () => {
    try {
      const subjects = await subjectService.getSubjects({ is_active: true });
      setAvailableSubjects(subjects);
    } catch (error) {
      console.error('Failed to load subjects:', error);
    }
  };

  const loadClassSubjects = async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const data = await classSubjectService.getClassSubjects(parseInt(selectedClassId));
      setClassSubjects(data);
    } catch (error) {
      console.error('Failed to load class subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load class subjects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectGroups = async () => {
    if (!selectedClassId) return;
    try {
      const data = await classSubjectService.getSubjectGroups(parseInt(selectedClassId));
      setSubjectGroups(data);
    } catch (error) {
      console.error('Failed to load subject groups:', error);
    }
  };

  const loadStudentsInClass = async () => {
    if (!selectedClassId) return;
    try {
      const { data } = await supabase
        .from('students')
        .select('id, full_name, admission_number')
        .eq('current_class_id', parseInt(selectedClassId))
        .eq('is_active', true)
        .order('full_name');
      setStudents(data || []);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const loadStudentCounts = async () => {
    if (!selectedClassId) return;
    try {
      const counts = await classSubjectService.getStudentCountsForClassSubjects(parseInt(selectedClassId));
      setStudentCounts(counts);
    } catch (error) {
      console.error('Failed to load student counts:', error);
    }
  };

  const handleViewAllocatedStudents = async (classSubject: ClassSubject) => {
    setSelectedClassSubject(classSubject);
    setLoadingStudentsList(true);
    setIsViewStudentsOpen(true);
    try {
      const studentsData = await classSubjectService.getStudentsForSubject(classSubject.id);
      setAllocatedStudentsList(studentsData);
    } catch (error) {
      console.error('Failed to load allocated students:', error);
      toast({
        title: "Error",
        description: "Failed to load student list",
        variant: "destructive"
      });
    } finally {
      setLoadingStudentsList(false);
    }
  };

  const handleAddSubject = async () => {
    if (!selectedClassId || !subjectForm.subject_id) {
      toast({
        title: "Error",
        description: "Please select a subject",
        variant: "destructive"
      });
      return;
    }

    try {
      await classSubjectService.addSubjectToClass(parseInt(selectedClassId), subjectForm);
      toast({
        title: "Success",
        description: "Subject added to class"
      });
      setIsAddSubjectOpen(false);
      resetSubjectForm();
      loadClassSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add subject",
        variant: "destructive"
      });
    }
  };

  const handleUpdateSubject = async (id: number, updates: Partial<ClassSubjectFormData>) => {
    try {
      await classSubjectService.updateClassSubject(id, updates);
      toast({ title: "Updated", description: "Subject settings updated" });
      loadClassSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update",
        variant: "destructive"
      });
    }
  };

  const handleRemoveSubject = async (id: number) => {
    if (!window.confirm('Remove this subject from the class?')) return;
    try {
      await classSubjectService.removeSubjectFromClass(id);
      toast({ title: "Removed", description: "Subject removed from class" });
      loadClassSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove",
        variant: "destructive"
      });
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedClassId || !groupForm.name.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      await classSubjectService.createSubjectGroup(parseInt(selectedClassId), groupForm);
      toast({ title: "Success", description: "Subject group created" });
      setIsCreateGroupOpen(false);
      setGroupForm({ name: '', description: '', min_subjects: 1, max_subjects: 2 });
      loadSubjectGroups();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive"
      });
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!window.confirm('Delete this subject group? Subjects will be unlinked.')) return;
    try {
      await classSubjectService.deleteSubjectGroup(id);
      toast({ title: "Deleted", description: "Subject group deleted" });
      loadSubjectGroups();
      loadClassSubjects();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete",
        variant: "destructive"
      });
    }
  };

  const handleAllocateStudents = async () => {
    if (!selectedClassSubject || selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one student",
        variant: "destructive"
      });
      return;
    }

    try {
      const currentYear = new Date().getFullYear();
      await classSubjectService.allocateStudentsToSubject(
        selectedClassSubject.id,
        selectedStudents,
        currentYear,
        1 // Default to term 1
      );
      toast({ title: "Success", description: `${selectedStudents.length} students allocated` });
      setIsAllocateStudentsOpen(false);
      setSelectedStudents([]);
      setSelectedClassSubject(null);
      loadStudentCounts(); // Refresh counts after allocation
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate students",
        variant: "destructive"
      });
    }
  };

  const handleAutoAllocateCompulsory = async () => {
    if (!selectedClassId) return;
    try {
      const currentYear = new Date().getFullYear();
      await classSubjectService.autoAllocateCompulsorySubjects(parseInt(selectedClassId), currentYear, 1);
      toast({ title: "Success", description: "All students allocated to compulsory subjects" });
      loadStudentCounts(); // Refresh counts after auto-allocation
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to auto-allocate",
        variant: "destructive"
      });
    }
  };

  const resetSubjectForm = () => {
    setSubjectForm({
      subject_id: 0,
      teacher_id: null,
      is_examinable: true,
      is_compulsory: true,
      periods_per_week: 3,
      subject_group_id: null,
      is_double: false,
      priority: 0,
      requires_special_room: false,
      preferred_room_type: null
    });
  };

  // Get subjects not already added to this class
  const getUnallocatedSubjects = () => {
    const allocatedIds = classSubjects.map(cs => cs.subject_id);
    return availableSubjects.filter(s => !allocatedIds.includes(s.id));
  };

  // Group subjects by their group
  const getGroupedSubjects = () => {
    const grouped: Record<string, ClassSubject[]> = { 'Compulsory': [], 'Ungrouped Electives': [] };
    
    subjectGroups.forEach(g => {
      grouped[g.name] = [];
    });

    classSubjects.forEach(cs => {
      if (cs.is_compulsory) {
        grouped['Compulsory'].push(cs);
      } else if (cs.subject_group_id && cs.subject_group) {
        const groupName = cs.subject_group.name;
        if (grouped[groupName]) {
          grouped[groupName].push(cs);
        } else {
          grouped['Ungrouped Electives'].push(cs);
        }
      } else {
        grouped['Ungrouped Electives'].push(cs);
      }
    });

    return grouped;
  };

  const selectedClass = classes.find(c => String(c.id) === selectedClassId);

  return (
    <div className="space-y-4">
      {/* Class Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Class Subject Allocation
          </CardTitle>
          <CardDescription>
            Manage subjects for each class, set examinable/elective status, and allocate students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 max-w-xs">
              <Label>Select Class</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={String(cls.id)}>
                      {cls.name} (Grade {cls.grade_level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassId && (
              <>
                <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Subject to {selectedClass?.name}</DialogTitle>
                      <DialogDescription>
                        Configure subject settings for this class
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Subject</Label>
                        <Select
                          value={subjectForm.subject_id ? String(subjectForm.subject_id) : ''}
                          onValueChange={(v) => setSubjectForm(prev => ({ ...prev, subject_id: parseInt(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getUnallocatedSubjects().map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {s.name} ({s.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Subject Teacher (Optional)</Label>
                        <Select
                          value={subjectForm.teacher_id ? String(subjectForm.teacher_id) : 'none'}
                          onValueChange={(v) => setSubjectForm(prev => ({ 
                            ...prev, 
                            teacher_id: v === 'none' ? null : parseInt(v) 
                          }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Assign teacher..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No teacher assigned</SelectItem>
                            {teachers.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.first_name} {t.last_name} ({t.employee_no})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Periods per Week</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={subjectForm.periods_per_week || 3}
                          onChange={(e) => setSubjectForm(prev => ({ 
                            ...prev, 
                            periods_per_week: parseInt(e.target.value) || 3 
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Double Period</Label>
                          <p className="text-xs text-muted-foreground">Schedule as consecutive paired slots</p>
                        </div>
                        <Switch
                          checked={subjectForm.is_double ?? false}
                          onCheckedChange={(c) => setSubjectForm(prev => ({ ...prev, is_double: c }))}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Priority (0–10)</Label>
                        <p className="text-xs text-muted-foreground">Higher = scheduled first during generation</p>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={subjectForm.priority ?? 0}
                          onChange={(e) => setSubjectForm(prev => ({
                            ...prev,
                            priority: Math.min(10, Math.max(0, parseInt(e.target.value) || 0))
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Special Room Required</Label>
                          <p className="text-xs text-muted-foreground">Needs a lab, hall, or other special room</p>
                        </div>
                        <Switch
                          checked={subjectForm.requires_special_room ?? false}
                          onCheckedChange={(c) => setSubjectForm(prev => ({
                            ...prev,
                            requires_special_room: c,
                            preferred_room_type: c ? prev.preferred_room_type : null
                          }))}
                        />
                      </div>

                      {subjectForm.requires_special_room && (
                        <div className="grid gap-2">
                          <Label>Room Type</Label>
                          <Select
                            value={subjectForm.preferred_room_type ?? 'any'}
                            onValueChange={(v) => setSubjectForm(prev => ({
                              ...prev,
                              preferred_room_type: v === 'any' ? null : v as ClassSubjectFormData['preferred_room_type']
                            }))}
                          >
                            <SelectTrigger><SelectValue placeholder="Select room type..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any special room</SelectItem>
                              <SelectItem value="lab">Science Lab</SelectItem>
                              <SelectItem value="computer">Computer Lab</SelectItem>
                              <SelectItem value="hall">Hall</SelectItem>
                              <SelectItem value="library">Library</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Examinable</Label>
                          <p className="text-xs text-muted-foreground">Include in exams/grading</p>
                        </div>
                        <Switch
                          checked={subjectForm.is_examinable}
                          onCheckedChange={(c) => setSubjectForm(prev => ({ ...prev, is_examinable: c }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Compulsory</Label>
                          <p className="text-xs text-muted-foreground">All students must take this subject</p>
                        </div>
                        <Switch
                          checked={subjectForm.is_compulsory}
                          onCheckedChange={(c) => {
                            setSubjectForm(prev => ({ 
                              ...prev, 
                              is_compulsory: c,
                              subject_group_id: c ? null : prev.subject_group_id 
                            }));
                          }}
                        />
                      </div>

                      {!subjectForm.is_compulsory && subjectGroups.length > 0 && (
                        <div className="grid gap-2">
                          <Label>Elective Group (Optional)</Label>
                          <Select
                            value={subjectForm.subject_group_id ? String(subjectForm.subject_group_id) : 'none'}
                            onValueChange={(v) => setSubjectForm(prev => ({ 
                              ...prev, 
                              subject_group_id: v === 'none' ? null : parseInt(v) 
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select group..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No group</SelectItem>
                              {subjectGroups.map((g) => (
                                <SelectItem key={g.id} value={String(g.id)}>
                                  {g.name} (Pick {g.min_subjects}-{g.max_subjects})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddSubjectOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddSubject}>Add Subject</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Elective Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Elective Group</DialogTitle>
                      <DialogDescription>
                        Group elective subjects together (e.g., "Choose 2 from: Art, Music, French")
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Group Name</Label>
                        <Input
                          placeholder="e.g., Arts & Languages"
                          value={groupForm.name}
                          onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Description (Optional)</Label>
                        <Input
                          placeholder="e.g., Choose 2 from this group"
                          value={groupForm.description}
                          onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Min Subjects</Label>
                          <Input
                            type="number"
                            min={1}
                            value={groupForm.min_subjects}
                            onChange={(e) => setGroupForm(prev => ({ 
                              ...prev, 
                              min_subjects: parseInt(e.target.value) || 1 
                            }))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Max Subjects</Label>
                          <Input
                            type="number"
                            min={1}
                            value={groupForm.max_subjects}
                            onChange={(e) => setGroupForm(prev => ({ 
                              ...prev, 
                              max_subjects: parseInt(e.target.value) || 2 
                            }))}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateGroup}>Create Group</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="secondary" onClick={handleAutoAllocateCompulsory}>
                  <Users className="mr-2 h-4 w-4" />
                  Auto-Allocate Compulsory
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Elective Groups */}
      {selectedClassId && subjectGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Elective Groups</CardTitle>
            <CardDescription>Grouped elective subjects for student selection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {subjectGroups.map((group) => (
                <Badge key={group.id} variant="secondary" className="px-3 py-1">
                  {group.name} (Pick {group.min_subjects}-{group.max_subjects})
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-2 hover:bg-destructive/20"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subjects Table */}
      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Subjects for {selectedClass?.name}
            </CardTitle>
            <CardDescription>
              {classSubjects.length} subjects allocated • {classSubjects.filter(s => s.is_examinable).length} examinable
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : classSubjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No subjects allocated to this class yet</p>
                <p className="text-sm">Click "Add Subject" to get started</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Periods/Week</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Examinable</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classSubjects.map((cs) => (
                    <TableRow key={cs.id}>
                      <TableCell className="font-medium">
                        {cs.subject?.name || 'Unknown'}
                        <span className="text-muted-foreground ml-1">({cs.subject?.code})</span>
                      </TableCell>
                      <TableCell>
                        {cs.teacher ? (
                          `${cs.teacher.first_name} ${cs.teacher.last_name}`
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>{cs.periods_per_week || 3}</TableCell>
                      <TableCell>
                        <Badge variant={cs.is_compulsory ? "default" : "secondary"}>
                          {cs.is_compulsory ? "Compulsory" : "Elective"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1 text-primary hover:underline p-0 h-auto"
                          onClick={() => handleViewAllocatedStudents(cs)}
                        >
                          <Users className="h-3 w-3" />
                          <span>{studentCounts[cs.id] || 0}</span>
                          <Eye className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={cs.is_examinable}
                          onCheckedChange={(checked) => handleUpdateSubject(cs.id, { is_examinable: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        {cs.subject_group ? (
                          <Badge variant="outline">{cs.subject_group.name}</Badge>
                        ) : cs.is_compulsory ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span className="text-muted-foreground">Ungrouped</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!cs.is_compulsory && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedClassSubject(cs);
                                setIsAllocateStudentsOpen(true);
                              }}
                              title="Allocate students"
                            >
                              <GraduationCap className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSubject(cs.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Allocate Students Dialog */}
      <Dialog open={isAllocateStudentsOpen} onOpenChange={setIsAllocateStudentsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate Students to {selectedClassSubject?.subject?.name}</DialogTitle>
            <DialogDescription>
              Select students who will take this elective subject
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            {students.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No students in this class</p>
            ) : (
              students.map((student) => (
                <div key={student.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                  <Checkbox
                    id={`student-${student.id}`}
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={(checked) => {
                      setSelectedStudents(prev => 
                        checked 
                          ? [...prev, student.id]
                          : prev.filter(id => id !== student.id)
                      );
                    }}
                  />
                  <label htmlFor={`student-${student.id}`} className="flex-1 cursor-pointer">
                    <span className="font-medium">{student.full_name}</span>
                    <span className="text-muted-foreground ml-2">({student.admission_number})</span>
                  </label>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStudents(students.map(s => s.id))}>
              Select All
            </Button>
            <Button variant="outline" onClick={() => setSelectedStudents([])}>
              Clear
            </Button>
            <Button onClick={handleAllocateStudents} disabled={selectedStudents.length === 0}>
              Allocate {selectedStudents.length} Students
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Allocated Students Dialog */}
      <Dialog open={isViewStudentsOpen} onOpenChange={setIsViewStudentsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Students Allocated to {selectedClassSubject?.subject?.name}
            </DialogTitle>
            <DialogDescription>
              {allocatedStudentsList.length} student{allocatedStudentsList.length !== 1 ? 's' : ''} enrolled in this subject
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto py-4">
            {loadingStudentsList ? (
              <div className="text-center py-8 text-muted-foreground">Loading students...</div>
            ) : allocatedStudentsList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No students allocated to this subject yet</p>
                {!selectedClassSubject?.is_compulsory && (
                  <p className="text-sm mt-1">Use the allocate button to add students</p>
                )}
                {selectedClassSubject?.is_compulsory && (
                  <p className="text-sm mt-1">Click "Auto-Allocate Compulsory" to enroll all students</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission No.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocatedStudentsList.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell>{student.admission_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewStudentsOpen(false)}>
              Close
            </Button>
            {!selectedClassSubject?.is_compulsory && (
              <Button 
                onClick={() => {
                  setIsViewStudentsOpen(false);
                  if (selectedClassSubject) {
                    setIsAllocateStudentsOpen(true);
                  }
                }}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Manage Allocation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
