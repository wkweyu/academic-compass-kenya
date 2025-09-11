import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, Users, Settings, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { teachingAssignmentService } from '@/services/teachingAssignmentService';

interface TeachingAssignment {
  id: number;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  class_id: number;
  class_name: string;
  stream_id?: number;
  stream_name?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  is_class_teacher: boolean;
  workload_hours: number;
  created_at: string;
}

export const TeachingAssignmentsTab = () => {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  // Mock data for selects
  const [teachers] = useState([
    { id: 1, name: 'Sarah Johnson' },
    { id: 2, name: 'Michael Ochieng' },
    { id: 3, name: 'Grace Wanjiku' }
  ]);
  
  const [subjects] = useState([
    { id: 1, name: 'Mathematics', code: 'MAT' },
    { id: 2, name: 'English', code: 'ENG' },
    { id: 3, name: 'Science', code: 'SCI' }
  ]);
  
  const [classes] = useState([
    { id: 1, name: 'Grade 1' },
    { id: 2, name: 'Grade 2' },
    { id: 3, name: 'Grade 3' }
  ]);

  const [assignmentForm, setAssignmentForm] = useState({
    teacher_id: 0,
    subject_id: 0,
    class_id: 0,
    stream_id: 0,
    academic_year: new Date().getFullYear(),
    term: 1 as 1 | 2 | 3,
    is_class_teacher: false,
    workload_hours: 4
  });

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await teachingAssignmentService.getAssignments();
      setAssignments(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load teaching assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!assignmentForm.teacher_id || !assignmentForm.subject_id || !assignmentForm.class_id) {
      toast({
        title: "Error",
        description: "Teacher, subject, and class are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await teachingAssignmentService.createAssignment(assignmentForm);
      toast({
        title: "Success",
        description: "Teaching assignment created successfully",
      });
      
      setIsCreateOpen(false);
      resetForm();
      loadAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm('Remove this teaching assignment?')) return;

    try {
      await teachingAssignmentService.deleteAssignment(id);
      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
      loadAssignments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setAssignmentForm({
      teacher_id: 0,
      subject_id: 0,
      class_id: 0,
      stream_id: 0,
      academic_year: new Date().getFullYear(),
      term: 1,
      is_class_teacher: false,
      workload_hours: 4
    });
  };

  const filteredAssignments = assignments.filter(assignment =>
    assignment.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.subject_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Teaching Assignments</CardTitle>
            <CardDescription>Assign teachers to subjects and classes</CardDescription>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Teaching Assignment</DialogTitle>
                <DialogDescription>
                  Assign a teacher to teach a subject in a specific class.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Teacher</Label>
                  <Select
                    value={assignmentForm.teacher_id.toString()}
                    onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, teacher_id: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id.toString()}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <Select
                    value={assignmentForm.subject_id.toString()}
                    onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, subject_id: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id.toString()}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Class</Label>
                  <Select
                    value={assignmentForm.class_id.toString()}
                    onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, class_id: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id.toString()}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Academic Year</Label>
                    <Input
                      type="number"
                      value={assignmentForm.academic_year}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, academic_year: parseInt(e.target.value) }))}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label>Term</Label>
                    <Select
                      value={assignmentForm.term.toString()}
                      onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, term: parseInt(value) as 1 | 2 | 3 }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Term 1</SelectItem>
                        <SelectItem value="2">Term 2</SelectItem>
                        <SelectItem value="3">Term 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label>Weekly Hours</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={assignmentForm.workload_hours}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, workload_hours: parseInt(e.target.value) }))}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="class-teacher"
                    checked={assignmentForm.is_class_teacher}
                    onCheckedChange={(checked) => setAssignmentForm(prev => ({ ...prev, is_class_teacher: checked }))}
                  />
                  <Label htmlFor="class-teacher">Class Teacher</Label>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleCreateAssignment} className="flex-1">
                    Create Assignment
                  </Button>
                  <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assignments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Assignments Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Teacher</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Hours/Week</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.teacher_name}</TableCell>
                <TableCell>
                  <div>
                    <div>{assignment.subject_name}</div>
                    <div className="text-sm text-muted-foreground">{assignment.subject_code}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {assignment.class_name}
                  {assignment.stream_name && ` ${assignment.stream_name}`}
                </TableCell>
                <TableCell>
                  {assignment.is_class_teacher ? (
                    <Badge className="bg-blue-100 text-blue-800">Class Teacher</Badge>
                  ) : (
                    <Badge variant="secondary">Subject Teacher</Badge>
                  )}
                </TableCell>
                <TableCell>{assignment.workload_hours}h</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {assignment.academic_year} T{assignment.term}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteAssignment(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredAssignments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No teaching assignments found.</p>
            <p className="text-sm">Create assignments to connect teachers with subjects and classes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};