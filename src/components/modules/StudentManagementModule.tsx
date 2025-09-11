<<<<<<< HEAD
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Filter,
  Users,
  GraduationCap,
  Phone,
  Edit3,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Student } from "@/types/cbc";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "@/services/studentService";
import { StudentForm } from "@/components/forms/StudentForm";
import { useDebounce } from "@/hooks/use-debounce";
import { DeleteConfirmationDialog } from "@/components/ui/DeleteConfirmationDialog";

export function StudentManagementModule() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
=======
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, Users, GraduationCap, Phone, Edit3, Eye, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Student } from '@/types/cbc';
import { getStudents, createStudent, updateStudent, deleteStudent } from '@/services/studentService';
import { StudentForm } from '@/components/forms/StudentForm';
import { useDebounce } from '@/hooks/use-debounce';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';

export function StudentManagementModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null); // For viewing
  const [editingStudent, setEditingStudent] = useState<Student | null>(null); // For editing
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
<<<<<<< HEAD
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null
  );
=======
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

<<<<<<< HEAD
  const {
    data: students,
    isLoading,
    isError,
    error,
  } = useQuery<Student[], Error>({
    queryKey: ["students", debouncedSearchTerm, selectedClass, selectedStatus],
    queryFn: () =>
      getStudents({
        search: debouncedSearchTerm,
        class: selectedClass,
        status: selectedStatus,
      }),
=======
  const { data: students, isLoading, isError, error } = useQuery<Student[], Error>({
    queryKey: ['students', debouncedSearchTerm, selectedClass, selectedStatus],
    queryFn: () => getStudents({
      search: debouncedSearchTerm,
      class: selectedClass,
      status: selectedStatus
    }),
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    placeholderData: (previousData) => previousData,
  });

  const createStudentMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
<<<<<<< HEAD
      queryClient.invalidateQueries({ queryKey: ["students"] });
=======
      queryClient.invalidateQueries({ queryKey: ['students'] });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      toast({ title: "Success", description: "Student created successfully." });
      setIsFormOpen(false);
      setEditingStudent(null);
    },
    onError: (err: Error) => {
<<<<<<< HEAD
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create student: ${err.message}`,
      });
=======
      toast({ variant: "destructive", title: "Error", description: `Failed to create student: ${err.message}` });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    },
  });

  const updateStudentMutation = useMutation({
<<<<<<< HEAD
    mutationFn: (data: { id: string; studentData: Partial<Student> }) =>
      updateStudent(data.id, data.studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
=======
    mutationFn: (data: { id: string; studentData: Partial<Student> }) => updateStudent(data.id, data.studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      toast({ title: "Success", description: "Student updated successfully." });
      setIsFormOpen(false);
      setEditingStudent(null);
    },
    onError: (err: Error) => {
<<<<<<< HEAD
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update student: ${err.message}`,
      });
=======
      toast({ variant: "destructive", title: "Error", description: `Failed to update student: ${err.message}` });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
<<<<<<< HEAD
      queryClient.invalidateQueries({ queryKey: ["students"] });
=======
      queryClient.invalidateQueries({ queryKey: ['students'] });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      toast({ title: "Success", description: "Student deleted successfully." });
      setIsDeleteDialogOpen(false);
      setDeletingStudentId(null);
    },
    onError: (err: Error) => {
<<<<<<< HEAD
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete student: ${err.message}`,
      });
=======
      toast({ variant: "destructive", title: "Error", description: `Failed to delete student: ${err.message}` });
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    },
  });

  const handleConfirmDelete = () => {
    if (deletingStudentId) {
      deleteStudentMutation.mutate(deletingStudentId);
    }
  };

  const handleFormSubmit = (values: any) => {
    const studentData = {
<<<<<<< HEAD
      ...values,
      current_class: parseInt(values.current_class, 10),
      current_stream: parseInt(values.current_stream, 10),
=======
        ...values,
        current_class: parseInt(values.current_class, 10),
        current_stream: parseInt(values.current_stream, 10),
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    };

    if (editingStudent) {
      updateStudentMutation.mutate({ id: editingStudent.id, studentData });
    } else {
      createStudentMutation.mutate(studentData);
    }
  };

  const handleAddNew = () => {
    setEditingStudent(null);
    setIsFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
<<<<<<< HEAD
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "transferred":
        return "outline";
      case "graduated":
        return "destructive";
      default:
        return "secondary";
=======
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'transferred': return 'outline';
      case 'graduated': return 'destructive';
      default: return 'secondary';
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    }
  };

  const calculateAge = (dateOfBirth: string) => {
<<<<<<< HEAD
    if (!dateOfBirth) return "N/A";
=======
    if (!dateOfBirth) return 'N/A';
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
<<<<<<< HEAD

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

=======
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
    return age;
  };

  const classes = [
<<<<<<< HEAD
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
=======
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5',
    'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
<<<<<<< HEAD
          <h2 className="text-3xl font-bold tracking-tight">
            Student Management
          </h2>
=======
          <h2 className="text-3xl font-bold tracking-tight">Student Management</h2>
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
          <p className="text-muted-foreground">
            Manage student records, enrollment, and information
          </p>
        </div>
<<<<<<< HEAD

=======
        
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>
<<<<<<< HEAD
=======

>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
<<<<<<< HEAD
            <DialogTitle>
              {editingStudent ? "Edit Student" : "Add New Student"}
            </DialogTitle>
            <DialogDescription>
              {editingStudent
                ? "Update the details of the student."
                : "Register a new student in the system."}
=======
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update the details of the student.' : 'Register a new student in the system.'}
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            initialData={editingStudent}
            onSubmit={handleFormSubmit}
<<<<<<< HEAD
            isSubmitting={
              createStudentMutation.isPending || updateStudentMutation.isPending
            }
          />
        </DialogContent>
      </Dialog>
      ){/* Filters */}
=======
            isSubmitting={createStudentMutation.isPending || updateStudentMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Filters */}
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students by name or admission number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
<<<<<<< HEAD

=======
            
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {/* This should ideally come from an API */}
                {classes.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {cls}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
<<<<<<< HEAD
                <SelectItem value="graduated">Graduated</SelectItem>
=======
<SelectItem value="graduated">Graduated</SelectItem>
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
<<<<<<< HEAD
=======

>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      {/* Content Area */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4 text-muted-foreground">Loading students...</p>
        </div>
      )}
<<<<<<< HEAD
=======

>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch students: {error.message}
          </AlertDescription>
        </Alert>
      )}
<<<<<<< HEAD
=======

>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
      {!isLoading && !isError && students && (
        <>
          {/* Student Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* These stats would also need to come from an API eventually */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
<<<<<<< HEAD
                <CardTitle className="text-sm font-medium">
                  Total Students
                </CardTitle>
=======
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{students.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Student List */}
          <div className="grid gap-4">
            {students.map((student) => (
<<<<<<< HEAD
              <Card
                key={student.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={student.photo || undefined}
                        alt={student.full_name}
                      />
                      <AvatarFallback>
                        {student.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>

=======
              <Card key={student.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={student.photo || undefined} alt={student.full_name} />
                      <AvatarFallback>
                        {student.full_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {student.full_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {student.admission_number}
                          </p>
                        </div>
                        <Badge variant={getStatusColor(student.status)}>
                          {student.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
<<<<<<< HEAD
                          <span>
                            {student.current_class_name}{" "}
                            {student.current_stream_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {student.gender},{" "}
                            {calculateAge(student.date_of_birth)} years
                          </span>
=======
                          <span>{student.current_class_name} {student.current_stream_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{student.gender}, {calculateAge(student.date_of_birth)} years</span>
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{student.guardian_phone}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
<<<<<<< HEAD
                          <span className="font-medium">Guardian:</span>{" "}
                          {student.guardian_name}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(student)}
                          >
                            <Edit3 className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeletingStudentId(student.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
=======
                          <span className="font-medium">Guardian:</span> {student.guardian_name}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedStudent(student)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(student)}>
                            <Edit3 className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => {
                            setDeletingStudentId(student.id);
                            setIsDeleteDialogOpen(true);
                          }}>
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {students.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No students found</h3>
                <p className="text-muted-foreground text-center max-w-sm">
<<<<<<< HEAD
                  Try adjusting your filters or add a new student to get
                  started.
=======
                  Try adjusting your filters or add a new student to get started.
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
<<<<<<< HEAD
      {/* Student Detail Dialog */}
      <>
        <Dialog
          open={!!selectedStudent}
          onOpenChange={() => setSelectedStudent(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                {/* ... Dialog content remains the same, but uses selectedStudent ... */}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <DeleteConfirmationDialog
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
          title="Are you sure?"
          description="This action cannot be undone. This will permanently delete the student record."
        />
      </>
    </div>
  );
}
=======

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
             <div className="space-y-4">
               <div className="flex items-center gap-4">
                 <Avatar className="h-16 w-16">
                   <AvatarImage src={selectedStudent.photo || undefined} alt={selectedStudent.full_name} />
                   <AvatarFallback>
                     {selectedStudent.full_name.split(' ').map(n => n[0]).join('')}
                   </AvatarFallback>
                 </Avatar>
                 <div>
                   <h3 className="text-xl font-semibold">{selectedStudent.full_name}</h3>
                   <p className="text-muted-foreground">{selectedStudent.admission_number}</p>
                   <Badge variant={getStatusColor(selectedStudent.status)}>
                     {selectedStudent.status.toUpperCase()}
                   </Badge>
                 </div>
               </div>
               
               <Separator />
               
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                   <p>{selectedStudent.date_of_birth}</p>
                 </div>
                 <div>
                   <label className="text-sm font-medium text-muted-foreground">Age</label>
                   <p>{calculateAge(selectedStudent.date_of_birth)} years</p>
                 </div>
                 <div>
                   <label className="text-sm font-medium text-muted-foreground">Gender</label>
                   <p>{selectedStudent.gender === 'M' ? 'Male' : selectedStudent.gender === 'F' ? 'Female' : 'Other'}</p>
                 </div>
                 <div>
                   <label className="text-sm font-medium text-muted-foreground">Enrollment Date</label>
                   <p>{selectedStudent.enrollment_date}</p>
                 </div>
               </div>
               
               <Separator />
               
               <div>
                 <h4 className="text-lg font-medium mb-2">Guardian Information</h4>
                 <div className="grid grid-cols-1 gap-2">
                   <div>
                     <label className="text-sm font-medium text-muted-foreground">Name</label>
                     <p>{selectedStudent.guardian_name}</p>
                   </div>
                   <div>
                     <label className="text-sm font-medium text-muted-foreground">Phone</label>
                     <p>{selectedStudent.guardian_phone}</p>
                   </div>
                   {selectedStudent.guardian_email && (
                     <div>
                       <label className="text-sm font-medium text-muted-foreground">Email</label>
                       <p>{selectedStudent.guardian_email}</p>
                     </div>
                   )}
                 </div>
               </div>
             </div>
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Are you sure?"
        description="This action cannot be undone. This will permanently delete the student record."
      />
    </div>
  );
}
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
