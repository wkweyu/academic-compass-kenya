import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Printer,
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
import { findExistingGuardian } from '@/services/guardianService';
import { StudentForm } from '@/components/forms/StudentForm';
import AdmissionFormPrint from '@/components/AdmissionFormPrint';
import { Student, StudentFilters, STUDENT_STATUS_OPTIONS, GENDER_OPTIONS } from '@/types/student';


const StudentManagementModule = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<StudentFilters>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printStudentData, setPrintStudentData] = useState<Omit<Student, 'id' | 'admission_number' | 'created_at' | 'updated_at'> | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch students
  const { data: students, isLoading, error } = useQuery({
    queryKey: ['students', filters],
    queryFn: () => getStudents(filters),
  });

  // Fetch student stats
  const { data: stats } = useQuery({
    queryKey: ['student-stats'],
    queryFn: getStudentStats,
  });
  
  // Create student mutation
  const createMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: (createdStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      setIsCreateDialogOpen(false);
      toast.success('Student created successfully');
      
      // Show print dialog immediately after successful creation
      if (createdStudent) {
        setPrintStudentData(createdStudent);
        // Use a small timeout to ensure dialog state updates properly
        setTimeout(() => {
          setShowPrintDialog(true);
        }, 100);
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to create student';
      toast.error(errorMessage);
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
      
      // Show detailed results
      if (result.success > 0 && result.errors === 0 && result.warnings === 0) {
        toast.success(`Successfully imported ${result.success} student${result.success !== 1 ? 's' : ''}`);
      } else if (result.success > 0 && (result.errors > 0 || result.warnings > 0)) {
        toast.warning(
          `Import completed with issues: ${result.success} successful, ${result.errors} failed, ${result.warnings} warnings`,
          { duration: 5000 }
        );
        
        // Show first few errors/warnings
        const issues = result.details.slice(0, 3);
        issues.forEach(detail => {
          if (detail.type === 'error') {
            toast.error(`Row ${detail.row}: ${detail.message}`, { duration: 5000 });
          } else if (detail.type === 'warning') {
            toast.warning(`Row ${detail.row}: ${detail.message}`, { duration: 4000 });
          }
        });
        
        if (result.details.length > 3) {
          toast.info(`...and ${result.details.length - 3} more issues. Check console for full details.`);
          console.table(result.details);
        }
      } else {
        toast.error(`Import failed: ${result.errors} errors. Check the file format and try again.`);
        result.details.slice(0, 5).forEach(detail => {
          toast.error(`Row ${detail.row}: ${detail.message}`, { duration: 5000 });
        });
        console.table(result.details);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import students. Please check the file format.');
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

  const handleViewStudent = (studentId: string) => {
    navigate(`/students/${studentId}`);
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
                    {student.siblings && student.siblings.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{student.siblings.length} sibling{student.siblings.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
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

              {/* Transport & Family Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Transport & Family</h3>
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
                  {selectedStudent.siblings && selectedStudent.siblings.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Siblings in School</Label>
                      <div className="space-y-1">
                        {selectedStudent.siblings.map((sibling) => (
                          <div key={sibling.id} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {sibling.full_name} - {sibling.current_class_stream}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      {/* Create Student Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Student</DialogTitle>
            <DialogDescription>
              Enter student information to create a new student record
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            onSubmit={(data) => createMutation.mutate(data)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <StudentForm
              initialData={selectedStudent}
              onSubmit={(data) => updateMutation.mutate({ 
                id: selectedStudent.id, 
                data 
              })}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Students</DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import student records
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6">
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm">
                    <span className="text-primary font-medium">Click to upload</span>
                    {' or drag and drop'}
                  </div>
                  <p className="text-xs text-muted-foreground">CSV file only (max 5MB)</p>
                </div>
              </Label>
              <Input 
                id="csv-upload"
                type="file" 
                accept=".csv"
                className="hidden"
                disabled={importMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importMutation.mutate(file);
                  }
                }}
              />
            </div>
            
            {importMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Processing import... This may take a moment.
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Required Columns:</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>full_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>gender (M/F or Male/Female)</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>guardian_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-destructive">*</span>
                  <span>guardian_phone</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">date_of_birth</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">guardian_email</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">current_class_name</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="text-muted-foreground">○</span>
                  <span className="text-muted-foreground">current_stream_name</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic mt-2">
                * Required fields | ○ Optional fields
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsImportDialogOpen(false)}
              disabled={importMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
              disabled={importMutation.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Student Admission Form
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              Review and print the admission form for this student
            </div>
          </DialogHeader>
          {printStudentData && (
            <div className="space-y-4">
              <div id="admission-form-content">
                <AdmissionFormPrint 
                  student={printStudentData} 
                  admissionNumber={`${new Date().getFullYear()}-${String(students.length + 1).padStart(4, '0')}`}
                  siblings={printStudentData.guardian_phone ? 
                    students.filter(s => 
                      s.guardian_phone === printStudentData.guardian_phone && 
                      s.full_name !== printStudentData.full_name
                    ) : []
                  }
                />
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPrintDialog(false)}
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const printContent = document.getElementById('admission-form-content');
                    if (printContent) {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Admission Form - ${printStudentData.full_name}</title>
                              <style>
                                body { 
                                  font-family: Arial, sans-serif; 
                                  margin: 0; 
                                  padding: 20px; 
                                  background: white;
                                  color: black;
                                }
                                .print-container { 
                                  max-width: 800px; 
                                  margin: 0 auto; 
                                }
                                @media print { 
                                  body { 
                                    margin: 0; 
                                    padding: 10px; 
                                  } 
                                  .print-container {
                                    max-width: none;
                                  }
                                }
                                h1, h2, h3 { color: black !important; }
                                .bg-gray-100 { background-color: #f3f4f6 !important; }
                                .border-gray-300 { border-color: #d1d5db !important; }
                                .border-gray-800 { border-color: #1f2937 !important; }
                                .text-gray-600 { color: #4b5563 !important; }
                                .text-gray-500 { color: #6b7280 !important; }
                              </style>
                            </head>
                            <body>
                              <div class="print-container">
                                ${printContent.innerHTML}
                              </div>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.focus();
                        setTimeout(() => {
                          printWindow.print();
                          printWindow.close();
                        }, 250);
                      }
                    }
                  }}
                  className="gap-2"
                >
                  <Printer size={16} />
                  Print Form
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { StudentManagementModule };