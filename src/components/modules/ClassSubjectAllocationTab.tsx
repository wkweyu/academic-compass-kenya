import { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { subjectService } from '@/services/subjectService';
import { teacherService } from '@/services/teacherService';
import { classService } from '@/services/classService';
import { Subject, ClassSubject } from '@/types/subject';

interface ClassSubjectAllocationTabProps {
  subjects: Subject[];
  onRefresh: () => void;
}

interface ClassData {
  id: number;
  name: string;
  grade_level: number;
}

interface TeacherData {
  id: number;
  first_name: string;
  last_name: string;
  employee_no: string;
}

const ClassSubjectAllocationTab = ({ subjects, onRefresh }: ClassSubjectAllocationTabProps) => {
  const { toast } = useToast();
  const [allocations, setAllocations] = useState<ClassSubject[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAllocateOpen, setIsAllocateOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'by-class' | 'by-subject'>('by-class');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');

  const [allocateForm, setAllocateForm] = useState({
    class_id: null as number | null,
    selected_subjects: [] as number[],
    teacher_assignments: {} as Record<number, number | null>
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allocData, classData, teacherData] = await Promise.all([
        subjectService.getClassSubjects(),
        classService.getClasses(),
        teacherService.getTeachers()
      ]);
      
      setAllocations(allocData);
      setClasses(classData.map((c: any) => ({ id: c.id, name: c.name, grade_level: c.grade_level })));
      setTeachers(teacherData.map((t: any) => ({ 
        id: t.id, 
        first_name: t.first_name, 
        last_name: t.last_name, 
        employee_no: t.employee_no 
      })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!allocateForm.class_id || allocateForm.selected_subjects.length === 0) {
      toast({ title: "Error", description: "Select a class and at least one subject", variant: "destructive" });
      return;
    }

    try {
      for (const subjectId of allocateForm.selected_subjects) {
        await subjectService.allocateSubjectToClass({
          class_id: allocateForm.class_id,
          subject_id: subjectId,
          teacher_id: allocateForm.teacher_assignments[subjectId] || null
        });
      }
      
      toast({ title: "Success", description: `${allocateForm.selected_subjects.length} subjects allocated to class` });
      setIsAllocateOpen(false);
      resetAllocateForm();
      loadData();
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to allocate subjects",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAllocation = async (allocation: ClassSubject) => {
    if (!window.confirm(`Remove ${allocation.subject?.name} from ${allocation.class?.name}?`)) {
      return;
    }

    try {
      await subjectService.removeSubjectFromClass(allocation.id);
      toast({ title: "Success", description: "Subject removed from class" });
      loadData();
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove subject",
        variant: "destructive",
      });
    }
  };

  const handleAssignTeacher = async (allocationId: number, teacherId: number | null) => {
    try {
      await subjectService.updateClassSubject(allocationId, { teacher_id: teacherId });
      toast({ title: "Success", description: "Teacher assigned" });
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign teacher", variant: "destructive" });
    }
  };

  const resetAllocateForm = () => {
    setAllocateForm({
      class_id: null,
      selected_subjects: [],
      teacher_assignments: {}
    });
  };

  const toggleSubjectSelection = (subjectId: number) => {
    setAllocateForm(prev => ({
      ...prev,
      selected_subjects: prev.selected_subjects.includes(subjectId)
        ? prev.selected_subjects.filter(id => id !== subjectId)
        : [...prev.selected_subjects, subjectId]
    }));
  };

  // Get allocations for selected class to prevent duplicates
  const existingAllocationsForClass = allocations
    .filter(a => a.class_id === allocateForm.class_id)
    .map(a => a.subject_id);

  const availableSubjects = subjects.filter(s => !existingAllocationsForClass.includes(s.id));

  // Filter allocations
  const filteredAllocations = allocations.filter(a => {
    if (filterClassId !== 'all' && a.class_id !== parseInt(filterClassId)) return false;
    if (filterSubjectId !== 'all' && a.subject_id !== parseInt(filterSubjectId)) return false;
    return true;
  });

  // Group allocations
  const groupedByClass = filteredAllocations.reduce((acc, alloc) => {
    const className = alloc.class?.name || 'Unknown';
    if (!acc[className]) acc[className] = [];
    acc[className].push(alloc);
    return acc;
  }, {} as Record<string, ClassSubject[]>);

  const groupedBySubject = filteredAllocations.reduce((acc, alloc) => {
    const subjectName = alloc.subject?.name || 'Unknown';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(alloc);
    return acc;
  }, {} as Record<string, ClassSubject[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Class-Subject Allocations</CardTitle>
            <CardDescription>Assign subjects to classes and assign teachers</CardDescription>
          </div>
          <Dialog open={isAllocateOpen} onOpenChange={setIsAllocateOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetAllocateForm}>
                <Plus className="mr-2 h-4 w-4" />
                Allocate Subjects
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Allocate Subjects to Class</DialogTitle>
                <DialogDescription>
                  Select a class and choose subjects to allocate.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Class Selection */}
                <div className="grid gap-2">
                  <Label>Select Class *</Label>
                  <Select
                    value={allocateForm.class_id?.toString() || ''}
                    onValueChange={(v) => setAllocateForm(prev => ({ 
                      ...prev, 
                      class_id: parseInt(v),
                      selected_subjects: [],
                      teacher_assignments: {}
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name} (Grade {cls.grade_level})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject Selection */}
                {allocateForm.class_id && (
                  <div className="grid gap-2">
                    <Label>Select Subjects</Label>
                    <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-2">
                      {availableSubjects.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          All subjects are already allocated to this class.
                        </p>
                      ) : (
                        availableSubjects.map(subject => (
                          <div key={subject.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={allocateForm.selected_subjects.includes(subject.id)}
                                onCheckedChange={() => toggleSubjectSelection(subject.id)}
                              />
                              <div>
                                <div className="font-medium">{subject.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {subject.code} • {subject.is_core ? 'Core' : 'Elective'}
                                </div>
                              </div>
                            </div>
                            
                            {allocateForm.selected_subjects.includes(subject.id) && (
                              <Select
                                value={allocateForm.teacher_assignments[subject.id]?.toString() || 'none'}
                                onValueChange={(v) => setAllocateForm(prev => ({
                                  ...prev,
                                  teacher_assignments: {
                                    ...prev.teacher_assignments,
                                    [subject.id]: v === 'none' ? null : parseInt(v)
                                  }
                                }))}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Assign teacher" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No teacher</SelectItem>
                                  {teachers.map(t => (
                                    <SelectItem key={t.id} value={t.id.toString()}>
                                      {t.first_name} {t.last_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {allocateForm.selected_subjects.length} subjects selected
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleAllocate} className="flex-1" disabled={allocateForm.selected_subjects.length === 0}>
                    Allocate Subjects
                  </Button>
                  <Button variant="outline" onClick={() => setIsAllocateOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={viewMode} onValueChange={(v: 'by-class' | 'by-subject') => setViewMode(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="by-class">View by Class</SelectItem>
              <SelectItem value="by-subject">View by Subject</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(cls => (
                <SelectItem key={cls.id} value={cls.id.toString()}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterSubjectId} onValueChange={setFilterSubjectId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(sub => (
                <SelectItem key={sub.id} value={sub.id.toString()}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Allocations Display */}
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : filteredAllocations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No allocations found. Click "Allocate Subjects" to assign subjects to classes.
          </div>
        ) : viewMode === 'by-class' ? (
          <div className="space-y-6">
            {Object.entries(groupedByClass).map(([className, allocs]) => (
              <div key={className} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-4">{className}</h3>
                <div className="grid gap-2">
                  {allocs.map(alloc => (
                    <div key={alloc.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{alloc.subject?.code}</Badge>
                        <span>{alloc.subject?.name}</span>
                        <Badge variant={alloc.subject?.is_core ? 'default' : 'secondary'} className="text-xs">
                          {alloc.subject?.is_core ? 'Core' : 'Elective'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={alloc.teacher_id?.toString() || 'none'}
                          onValueChange={(v) => handleAssignTeacher(alloc.id, v === 'none' ? null : parseInt(v))}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Assign teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No teacher</SelectItem>
                            {teachers.map(t => (
                              <SelectItem key={t.id} value={t.id.toString()}>
                                {t.first_name} {t.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveAllocation(alloc)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedBySubject).map(([subjectName, allocs]) => (
              <div key={subjectName} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-4">{subjectName}</h3>
                <div className="grid gap-2">
                  {allocs.map(alloc => (
                    <div key={alloc.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                      <div className="flex items-center gap-3">
                        <span>{alloc.class?.name}</span>
                        <Badge variant="outline">Grade {alloc.class?.grade_level}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {alloc.teacher && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {alloc.teacher.first_name} {alloc.teacher.last_name}
                          </div>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveAllocation(alloc)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClassSubjectAllocationTab;
