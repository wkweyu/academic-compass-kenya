import { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, GraduationCap, Settings, Edit, Trash2, Eye, Power, PowerOff, Layers, Users, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { subjectService } from '@/services/subjectService';
import { Subject, SubjectCategory, SubjectStats, SubjectFilters } from '@/types/subject';
import SubjectCategoriesTab from './SubjectCategoriesTab';
import ClassSubjectAllocationTab from './ClassSubjectAllocationTab';
import SubjectDetailDialog from './SubjectDetailDialog';

interface SubjectManagementModuleProps {
  defaultTab?: string;
}

export const SubjectManagementModule = ({ defaultTab = 'subjects' }: SubjectManagementModuleProps) => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<SubjectCategory[]>([]);
  const [stats, setStats] = useState<SubjectStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filters, setFilters] = useState<SubjectFilters>({});

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    description: '',
    is_core: true,
    is_active: true,
    category_id: null as number | null,
    grade_levels: [] as number[]
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subjectData, categoryData, statsData] = await Promise.all([
        subjectService.getSubjects({ ...filters, search: searchTerm }),
        subjectService.getCategories(),
        subjectService.getSubjectStats()
      ]);
      
      setSubjects(subjectData);
      setCategories(categoryData);
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

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
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

    // Check uniqueness
    const { nameExists, codeExists } = await subjectService.checkNameCodeUnique(
      subjectForm.name.trim(),
      subjectForm.code.trim()
    );

    if (nameExists) {
      toast({ title: "Error", description: "Subject name already exists", variant: "destructive" });
      return;
    }
    if (codeExists) {
      toast({ title: "Error", description: "Subject code already exists", variant: "destructive" });
      return;
    }

    try {
      await subjectService.createSubject({
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description,
        is_core: subjectForm.is_core,
        is_active: subjectForm.is_active,
        category_id: subjectForm.category_id,
        grade_levels: subjectForm.grade_levels,
        school_id: null
      });
      
      toast({ title: "Success", description: "Subject created successfully" });
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

    // Check uniqueness (excluding current subject)
    const { nameExists, codeExists } = await subjectService.checkNameCodeUnique(
      subjectForm.name.trim(),
      subjectForm.code.trim(),
      selectedSubject.id
    );

    if (nameExists) {
      toast({ title: "Error", description: "Subject name already exists", variant: "destructive" });
      return;
    }
    if (codeExists) {
      toast({ title: "Error", description: "Subject code already exists", variant: "destructive" });
      return;
    }

    try {
      await subjectService.updateSubject(selectedSubject.id, {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim().toUpperCase(),
        description: subjectForm.description,
        is_core: subjectForm.is_core,
        is_active: subjectForm.is_active,
        category_id: subjectForm.category_id,
        grade_levels: subjectForm.grade_levels
      });
      
      toast({ title: "Success", description: "Subject updated successfully" });
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

  const handleDeleteSubject = async (subject: Subject) => {
    try {
      await subjectService.deleteSubject(subject.id);
      toast({ title: "Success", description: "Subject deleted successfully" });
      loadData();
    } catch (error: any) {
      toast({
        title: "Cannot Delete Subject",
        description: error.message || "Failed to delete subject",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (subject: Subject) => {
    try {
      if (subject.is_active) {
        await subjectService.deactivateSubject(subject.id);
        toast({ title: "Success", description: "Subject deactivated" });
      } else {
        await subjectService.activateSubject(subject.id);
        toast({ title: "Success", description: "Subject activated" });
      }
      loadData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const openEditDialog = (subject: Subject) => {
    setSelectedSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code,
      description: subject.description || '',
      is_core: subject.is_core,
      is_active: subject.is_active,
      category_id: subject.category_id,
      grade_levels: subject.grade_levels || []
    });
    setIsEditOpen(true);
  };

  const openDetailDialog = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDetailOpen(true);
  };

  const resetForm = () => {
    setSubjectForm({
      name: '',
      code: '',
      description: '',
      is_core: true,
      is_active: true,
      category_id: null,
      grade_levels: []
    });
  };

  const filteredSubjects = subjects.filter(subject =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const parseGradeLevels = (input: string): number[] => {
    const grades: number[] = [];
    const parts = input.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) {
            if (!grades.includes(i)) grades.push(i);
          }
        }
      } else {
        const num = parseInt(trimmed);
        if (!isNaN(num) && !grades.includes(num)) grades.push(num);
      }
    }
    
    return grades.sort((a, b) => a - b);
  };

  const formatGradeLevels = (grades: number[]): string => {
    if (!grades || grades.length === 0) return '';
    const sorted = [...grades].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0].toString();
    
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];
    
    for (let i = 1; i <= sorted.length; i++) {
      if (i < sorted.length && sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        if (i < sorted.length) {
          start = sorted[i];
          end = sorted[i];
        }
      }
    }
    
    return ranges.join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subject Management</h1>
          <p className="text-muted-foreground">
            Manage school subjects, categories, and class allocations
          </p>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_subjects}</div>
              <p className="text-xs text-muted-foreground">All subjects</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Power className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_subjects}</div>
              <p className="text-xs text-muted-foreground">Can be assigned</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Core Subjects</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.core_subjects}</div>
              <p className="text-xs text-muted-foreground">Mandatory</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Electives</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.elective_subjects}</div>
              <p className="text-xs text-muted-foreground">Optional</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground">Subject groups</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content with Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4" key={defaultTab}>
        <TabsList>
          <TabsTrigger value="subjects">All Subjects</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="allocations">Class Allocations</TabsTrigger>
        </TabsList>

        {/* Subjects Tab */}
        <TabsContent value="subjects">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subjects</CardTitle>
                  <CardDescription>Manage your school's subject catalog</CardDescription>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create New Subject</DialogTitle>
                      <DialogDescription>
                        Add a new subject to your school curriculum.
                      </DialogDescription>
                    </DialogHeader>
                    <SubjectForm
                      form={subjectForm}
                      setForm={setSubjectForm}
                      categories={categories}
                      onSubmit={handleCreateSubject}
                      onCancel={() => { setIsCreateOpen(false); resetForm(); }}
                      parseGradeLevels={parseGradeLevels}
                      formatGradeLevels={formatGradeLevels}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or code..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select
                  value={filters.category_id?.toString() || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, category_id: v === 'all' ? undefined : parseInt(v) }))}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.is_active === undefined ? 'all' : filters.is_active.toString()}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, is_active: v === 'all' ? undefined : v === 'true' }))}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filters.is_core === undefined ? 'all' : filters.is_core.toString()}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, is_core: v === 'all' ? undefined : v === 'true' }))}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="true">Core</SelectItem>
                    <SelectItem value="false">Elective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subjects Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Classes</TableHead>
                      <TableHead>Teachers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredSubjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No subjects found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubjects.map((subject) => (
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
                            {subject.category ? (
                              <Badge variant="secondary">{(subject.category as any).name}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={subject.is_core ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}>
                              {subject.is_core ? 'Core' : 'Elective'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={subject.is_active ? 'default' : 'secondary'}>
                              {subject.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              {subject.assigned_classes || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {subject.assigned_teachers || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openDetailDialog(subject)} title="View Details">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(subject)} title="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleStatus(subject)}
                                title={subject.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {subject.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteSubject(subject)}
                                title="Delete"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories">
          <SubjectCategoriesTab 
            categories={categories} 
            onRefresh={loadData} 
          />
        </TabsContent>

        {/* Class Allocations Tab */}
        <TabsContent value="allocations">
          <ClassSubjectAllocationTab 
            subjects={subjects.filter(s => s.is_active)}
            onRefresh={loadData}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update subject information.</DialogDescription>
          </DialogHeader>
          <SubjectForm
            form={subjectForm}
            setForm={setSubjectForm}
            categories={categories}
            onSubmit={handleEditSubject}
            onCancel={() => { setIsEditOpen(false); setSelectedSubject(null); resetForm(); }}
            parseGradeLevels={parseGradeLevels}
            formatGradeLevels={formatGradeLevels}
          />
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selectedSubject && (
        <SubjectDetailDialog
          subject={selectedSubject}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
        />
      )}
    </div>
  );
};

// Subject Form Component
interface SubjectFormProps {
  form: any;
  setForm: (form: any) => void;
  categories: SubjectCategory[];
  onSubmit: () => void;
  onCancel: () => void;
  parseGradeLevels: (input: string) => number[];
  formatGradeLevels: (grades: number[]) => string;
}

const SubjectForm = ({ form, setForm, categories, onSubmit, onCancel, parseGradeLevels, formatGradeLevels }: SubjectFormProps) => {
  const [gradeLevelsInput, setGradeLevelsInput] = useState(formatGradeLevels(form.grade_levels));

  const handleGradeLevelsChange = (value: string) => {
    setGradeLevelsInput(value);
    setForm((prev: any) => ({ ...prev, grade_levels: parseGradeLevels(value) }));
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="subject-name">Subject Name *</Label>
          <Input
            id="subject-name"
            value={form.name}
            onChange={(e) => setForm((prev: any) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Mathematics"
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="subject-code">Subject Code *</Label>
          <Input
            id="subject-code"
            value={form.code}
            onChange={(e) => setForm((prev: any) => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="e.g., MAT"
            maxLength={10}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={form.category_id?.toString() || 'none'}
            onValueChange={(v) => setForm((prev: any) => ({ ...prev, category_id: v === 'none' ? null : parseInt(v) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="grade-levels">Grade Levels</Label>
          <Input
            id="grade-levels"
            value={gradeLevelsInput}
            onChange={(e) => handleGradeLevelsChange(e.target.value)}
            placeholder="e.g., 1-8 or 4,5,6"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="is-core"
            checked={form.is_core}
            onCheckedChange={(checked) => setForm((prev: any) => ({ ...prev, is_core: checked }))}
          />
          <Label htmlFor="is-core">Core Subject</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="is-active"
            checked={form.is_active}
            onCheckedChange={(checked) => setForm((prev: any) => ({ ...prev, is_active: checked }))}
          />
          <Label htmlFor="is-active">Active</Label>
        </div>
      </div>
      
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
          rows={3}
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
};

export default SubjectManagementModule;
