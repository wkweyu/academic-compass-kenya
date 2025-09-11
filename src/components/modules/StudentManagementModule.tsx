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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null); // For viewing
  const [editingStudent, setEditingStudent] = useState<Student | null>(null); // For editing
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
    placeholderData: (previousData) => previousData,
  });

  const createStudentMutation = useMutation({
    mutationFn: createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Success", description: "Student created successfully." });
      setIsFormOpen(false);
      setEditingStudent(null);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create student: ${err.message}`,
      });
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: (data: { id: string; studentData: Partial<Student> }) =>
      updateStudent(data.id, data.studentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Success", description: "Student updated successfully." });
      setIsFormOpen(false);
      setEditingStudent(null);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update student: ${err.message}`,
      });
    },
  });

  const deleteStudentMutation = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({ title: "Success", description: "Student deleted successfully." });
      setIsDeleteDialogOpen(false);
      setDeletingStudentId(null);
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete student: ${err.message}`,
      });
    },
  });

  const handleConfirmDelete = () => {
    if (deletingStudentId) {
      deleteStudentMutation.mutate(deletingStudentId);
    }
  };

  const handleFormSubmit = (values: any) => {
    const studentData = {
      ...values,
      current_class: parseInt(values.current_class, 10),
      current_stream: parseInt(values.current_stream, 10),
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
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return "N/A";
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age;
  };

  const classes = [
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Student Management
          </h2>
          <p className="text-muted-foreground">
            Manage student records, enrollment, and information
          </p>
        </div>

        <Button onClick={handleAddNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </div>
      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingStudent ? "Edit Student" : "Add New Student"}
            </DialogTitle>
            <DialogDescription>
              {editingStudent
                ? "Update the details of the student."
                : "Register a new student in the system."}
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            initialData={editingStudent}
            onSubmit={handleFormSubmit}
            isSubmitting={
              createStudentMutation.isPending || updateStudentMutation.isPending
            }
          />
        </DialogContent>
      </Dialog>
      ){/* Filters */}
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
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Content Area */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-4 text-muted-foreground">Loading students...</p>
        </div>
      )}
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to fetch students: {error.message}
          </AlertDescription>
        </Alert>
      )}
      {!isLoading && !isError && students && (
        <>
          {/* Student Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* These stats would also need to come from an API eventually */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Students
                </CardTitle>
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
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{student.guardian_phone}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
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
                  Try adjusting your filters or add a new student to get
                  started.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
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
