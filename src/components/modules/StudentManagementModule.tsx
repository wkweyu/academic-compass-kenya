import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Upload, 
  Filter,
  Users,
  GraduationCap,
  Phone,
  Mail,
  MapPin,
  Calendar,
  UserCheck,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { 
  getStudents, 
  getStudentById, 
  createStudent, 
  updateStudent, 
  deleteStudent,
  getStudentStats,
  bulkImportStudents,
  exportStudents,
  getImportTemplate
} from '@/services/studentService';
import { Student, StudentFilters, STUDENT_STATUS_OPTIONS, GENDER_OPTIONS } from '@/types/student';

const StudentManagementModule = () => {
  const [filters, setFilters] = useState<StudentFilters>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch students
  const { data: studentsResponse, isLoading, error } = useQuery({
    queryKey: ['students', filters],
    queryFn: () => getStudents(filters),
  });

  // Fetch student stats
  const { data: stats } = useQuery({
    queryKey: ['student-stats'],
    queryFn: getStudentStats,
  });

  const students = studentsResponse?.data || [];
  
  // Create student mutation
  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsCreateDialogOpen(false);
      toast.success('Student created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create student');
      console.error('Create student error:', error);
    },
  });

  // Update student mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) => 
      updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsEditDialogOpen(false);
      setSelectedStudent(null);
      toast.success('Student updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update student');
      console.error('Update student error:', error);
    },
  });

  // Delete student mutation
  const deleteMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      toast.success('Student deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete student');
      console.error('Delete student error:', error);
    },
  });

  // Import students mutation
  const importMutation = useMutation({
    mutationFn: bulkImportStudents,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsImportDialogOpen(false);
      toast.success(`Import completed: ${result.success} successful, ${result.errors} errors`);
    },
    onError: (error) => {
      toast.error('Failed to import students');
      console.error('Import error:', error);
    },
  });

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm }));
  };

  const handleFilterChange = (key: keyof StudentFilters, value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      [key]: value === 'all' ? undefined : value 
    }));
  };

  const handleViewStudent = async (studentId: string) => {
    try {
      const student = await getStudentById(studentId);
      if (student) {
        setSelectedStudent(student);
        setIsDetailsDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load student details');
    }
  };

  const handleEditStudent = async (studentId: string) => {
    try {
      const student = await getStudentById(studentId);
      if (student) {
        setSelectedStudent(student);
        setIsEditDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load student details');
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      deleteMutation.mutate(studentId);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportStudents(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Student data exported successfully');
    } catch (error) {
      toast.error('Failed to export student data');
    }
  };

  const handleDownloadTemplate = () => {
    const blob = getImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded successfully');
  };

  const getStatusBadgeColor = (status: string) => {
    const statusOption = STUDENT_STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption?.color || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-sm text-destructive">Failed to load students</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Student Management</h1>
          <p className="text-muted-foreground">Manage student records, enrollment, and academic information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Template
          </Button>
          <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_students}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active_students}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Male Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.male_students}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Female Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-600">{stats.female_students}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.class || 'all'}
              onValueChange={(value) => handleFilterChange('class', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="Grade 1">Grade 1</SelectItem>
                <SelectItem value="Grade 2">Grade 2</SelectItem>
                <SelectItem value="Grade 3">Grade 3</SelectItem>
                <SelectItem value="Grade 4">Grade 4</SelectItem>
                <SelectItem value="Grade 5">Grade 5</SelectItem>
                <SelectItem value="Grade 6">Grade 6</SelectItem>
                <SelectItem value="Grade 7">Grade 7</SelectItem>
                <SelectItem value="Grade 8">Grade 8</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STUDENT_STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.gender || 'all'}
              onValueChange={(value) => handleFilterChange('gender', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                {GENDER_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {students.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No students found</h3>
            <p className="text-muted-foreground text-center">
              {Object.keys(filters).length > 0 
                ? "Try adjusting your search or filters" 
                : "Get started by adding your first student"
              }
            </p>
            {Object.keys(filters).length === 0 && (
              <Button 
                className="mt-4" 
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Student
              </Button>
            )}
          </div>
        ) : (
          students.map((student) => (
            <Card key={student.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={student.photo || undefined} alt={student.full_name} />
                    <AvatarFallback>
                      {student.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{student.full_name}</CardTitle>
                    <CardDescription>{student.admission_number}</CardDescription>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusBadgeColor(student.status)}>
                        {student.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {student.current_class_stream}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Age: {new Date().getFullYear() - new Date(student.date_of_birth).getFullYear()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="truncate">{student.guardian_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-3 w-3" />
                    <span>{student.guardian_name}</span>
                  </div>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">
                    Enrolled: {new Date(student.enrollment_date).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewStudent(student.id)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditStudent(student.id)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStudent(student.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Results summary */}
      {students.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {students.length} student{students.length !== 1 ? 's' : ''}
          {Object.keys(filters).some(key => filters[key as keyof StudentFilters]) && (
            <span> matching your filters</span>
          )}
        </div>
      )}

      {/* Student Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Complete information for {selectedStudent?.full_name}
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Personal Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Full Name</Label>
                    <p className="text-sm">{selectedStudent.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Admission Number</Label>
                    <p className="text-sm">{selectedStudent.admission_number}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Date of Birth</Label>
                    <p className="text-sm">{new Date(selectedStudent.date_of_birth).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Gender</Label>
                    <p className="text-sm">{selectedStudent.gender === 'M' ? 'Male' : 'Female'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge className={getStatusBadgeColor(selectedStudent.status)}>
                      {selectedStudent.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Academic Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Class</Label>
                    <p className="text-sm">{selectedStudent.current_class_stream}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Academic Year</Label>
                    <p className="text-sm">{selectedStudent.academic_year}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Enrollment Date</Label>
                    <p className="text-sm">{new Date(selectedStudent.enrollment_date).toLocaleDateString()}</p>
                  </div>
                  {selectedStudent.kcpe_index && (
                    <div>
                      <Label className="text-sm font-medium">KCPE Index</Label>
                      <p className="text-sm">{selectedStudent.kcpe_index}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Guardian Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Guardian Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Guardian Name</Label>
                    <p className="text-sm">{selectedStudent.guardian_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm">{selectedStudent.guardian_phone}</p>
                  </div>
                  {selectedStudent.guardian_email && (
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <p className="text-sm">{selectedStudent.guardian_email}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium">Relationship</Label>
                    <p className="text-sm">{selectedStudent.guardian_relationship}</p>
                  </div>
                </div>
              </div>

              {/* Transport Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transport & Others</h3>
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium">Transport</Label>
                    <p className="text-sm">
                      {selectedStudent.is_on_transport 
                        ? `Yes (${selectedStudent.transport_type})` 
                        : 'No'
                      }
                    </p>
                  </div>
                  {selectedStudent.special_needs && (
                    <div>
                      <Label className="text-sm font-medium">Special Needs</Label>
                      <p className="text-sm">{selectedStudent.special_needs}</p>
                    </div>
                  )}
                  {selectedStudent.notes && (
                    <div>
                      <Label className="text-sm font-medium">Notes</Label>
                      <p className="text-sm">{selectedStudent.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Students</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import student records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <Input 
                type="file" 
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importMutation.mutate(file);
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Make sure your CSV file includes the following columns:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>full_name</li>
                <li>gender (M/F)</li>
                <li>date_of_birth (YYYY-MM-DD)</li>
                <li>guardian_name</li>
                <li>guardian_phone</li>
                <li>current_class_name</li>
                <li>current_stream_name</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { StudentManagementModule };