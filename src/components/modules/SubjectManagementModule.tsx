import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, GraduationCap, Settings, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { subjectService } from '@/services/subjectService';

interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  grade_levels: string;
  created_at: string;
  updated_at: string;
  assigned_teachers?: number;
  total_students?: number;
}

interface SubjectStats {
  total_subjects: number;
  core_subjects: number;
  elective_subjects: number;
  subjects_by_grade: { [key: string]: number };
}

export const SubjectManagementModule = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<SubjectStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    description: '',
    is_core: true,
    grade_levels: '1-8'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subjectData, statsData] = await Promise.all([
        subjectService.getSubjects({ search: searchTerm }),
        subjectService.getSubjectStats()
      ]);
      
      setSubjects(subjectData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load subject data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      toast({
        title: "Error",
        description: "Subject name and code are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await subjectService.createSubject({
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description,
        is_core: subjectForm.is_core,
        grade_levels: subjectForm.grade_levels,
        school: 1 // Mock school ID
      });
      
      toast({
        title: "Success",
        description: "Subject created successfully",
      });
      
      setIsCreateOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create subject",
        variant: "destructive",
      });
    }
  };

  const handleEditSubject = async () => {
    if (!selectedSubject) return;

    try {
      await subjectService.updateSubject(selectedSubject.id, {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description,
        is_core: subjectForm.is_core,
        grade_levels: subjectForm.grade_levels
      });
      
      toast({
        title: "Success",
        description: "Subject updated successfully",
      });
      
      setIsEditOpen(false);
      setSelectedSubject(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subject",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubject = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return;

    try {
      await subjectService.deleteSubject(id);
      toast({
        title: "Success",
        description: "Subject deleted successfully",
      });
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete subject",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (subject: Subject) => {
    setSelectedSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      description: subject.description,
      is_core: subject.is_core,
      grade_levels: subject.grade_levels
    });
    setIsEditOpen(true);
  };

  const resetForm = () => {
    setSubjectForm({
      name: '',
      code: '',
      description: '',
      is_core: true,
      grade_levels: '1-8'
    });
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subject Management</h1>
          <p className="text-muted-foreground">
            Manage school subjects and curriculum structure
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Subject</DialogTitle>
              <DialogDescription>
                Add a new subject to your school curriculum.
              </DialogDescription>
            </DialogHeader>
            <SubjectForm
              form={subjectForm}
              setForm={setSubjectForm}
              onSubmit={handleCreateSubject}
              onCancel={() => { setIsCreateOpen(false); resetForm(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_subjects}</div>
              <p className="text-xs text-muted-foreground">
                Across all grade levels
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Core Subjects</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.core_subjects}</div>
              <p className="text-xs text-muted-foreground">
                Mandatory subjects
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Elective Subjects</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.elective_subjects}</div>
              <p className="text-xs text-muted-foreground">
                Optional subjects
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grade Coverage</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1-8</div>
              <p className="text-xs text-muted-foreground">
                CBC curriculum
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>All Subjects</CardTitle>
          <CardDescription>Manage your school's subject catalog</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Subjects Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Grade Levels</TableHead>
                <TableHead>Teachers</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{subject.name}</div>
                      {subject.description && (
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {subject.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{subject.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={subject.is_core ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                      {subject.is_core ? 'Core' : 'Elective'}
                    </Badge>
                  </TableCell>
                  <TableCell>{subject.grade_levels}</TableCell>
                  <TableCell>{subject.assigned_teachers || 0}</TableCell>
                  <TableCell>{subject.total_students || 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(subject)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteSubject(subject.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject information.
            </DialogDescription>
          </DialogHeader>
          <SubjectForm
            form={subjectForm}
            setForm={setSubjectForm}
            onSubmit={handleEditSubject}
            onCancel={() => { setIsEditOpen(false); setSelectedSubject(null); resetForm(); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Subject Form Component
interface SubjectFormProps {
  form: any;
  setForm: (form: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const SubjectForm = ({ form, setForm, onSubmit, onCancel }: SubjectFormProps) => (
  <div className="grid gap-4 py-4">
    <div className="grid gap-2">
      <Label htmlFor="subject-name">Subject Name</Label>
      <Input
        id="subject-name"
        value={form.name}
        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
        placeholder="e.g., Mathematics, English"
      />
    </div>
    
    <div className="grid gap-2">
      <Label htmlFor="subject-code">Subject Code</Label>
      <Input
        id="subject-code"
        value={form.code}
        onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
        placeholder="e.g., MAT, ENG"
        maxLength={10}
      />
    </div>
    
    <div className="grid gap-2">
      <Label htmlFor="grade-levels">Grade Levels</Label>
      <Input
        id="grade-levels"
        value={form.grade_levels}
        onChange={(e) => setForm(prev => ({ ...prev, grade_levels: e.target.value }))}
        placeholder="e.g., 1-8, 4-8, 7-8"
      />
    </div>
    
    <div className="flex items-center space-x-2">
      <Switch
        id="is-core"
        checked={form.is_core}
        onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_core: checked }))}
      />
      <Label htmlFor="is-core">Core Subject (Mandatory)</Label>
    </div>
    
    <div className="grid gap-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={form.description}
        onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Optional description"
      />
    </div>
    
    <div className="flex gap-2 pt-4">
      <Button onClick={onSubmit} className="flex-1">
        Save Subject
      </Button>
      <Button variant="outline" onClick={onCancel} className="flex-1">
        Cancel
      </Button>
    </div>
  </div>
);