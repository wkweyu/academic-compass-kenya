import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateStudent } from '@/services/studentService';
import { Student } from '@/types/student';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StudentForm } from '@/components/forms/StudentForm';
import { toast } from 'sonner';

interface StudentEditDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentEditDialog({ student, open, onOpenChange }: StudentEditDialogProps) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) =>
      updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      if (student) {
        queryClient.invalidateQueries({ queryKey: ['student', student.id] });
      }
      onOpenChange(false);
      toast.success('Student updated successfully');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update student');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>Update student information</DialogDescription>
        </DialogHeader>
        {student && (
          <StudentForm
            initialData={student}
            onSubmit={(data) => updateMutation.mutate({ id: student.id, data })}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
