import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Student, StudentLifecycleStatus } from '@/types/student';
import {
  suspendStudent,
  reinstateStudent,
  graduateStudent,
  archiveStudent,
} from '@/services/studentLifecycleService';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ChevronDown, AlertCircle, UserCheck, GraduationCap, Archive } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface StudentLifecycleActionsProps {
  student: Student;
  onActionComplete: () => void;
}

type PendingAction = 'suspend' | 'reinstate' | 'graduate' | 'archive' | null;

export function StudentLifecycleActions({
  student,
  onActionComplete,
}: StudentLifecycleActionsProps) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');

  // Fall back to 'active' when status is null/undefined so dropdown items always render
  const currentStatus: StudentLifecycleStatus =
    (student.status as StudentLifecycleStatus) || 'active';

  const isTerminal =
    currentStatus === 'graduated' ||
    currentStatus === 'archived' ||
    currentStatus === 'transferred';

  const mutation = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (!action) return;
      switch (action) {
        case 'suspend':
          return suspendStudent(student.id, currentStatus, reason);
        case 'reinstate':
          return reinstateStudent(student.id);
        case 'graduate':
          return graduateStudent(student.id);
        case 'archive':
          return archiveStudent(student.id, currentStatus, reason);
      }
    },
    onSuccess: (_, action) => {
      const labels: Record<NonNullable<PendingAction>, string> = {
        suspend:   'Student suspended',
        reinstate: 'Student reinstated',
        graduate:  'Student graduated',
        archive:   'Student archived',
      };
      toast({ title: labels[action!] ?? 'Status updated' });
      queryClient.invalidateQueries({ queryKey: ['student', student.id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['student-academic-history', student.id] });
      onActionComplete();
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast({
        title: 'Action failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  function handleCloseDialog() {
    setPendingAction(null);
    setReason('');
  }

  function handleConfirm() {
    mutation.mutate(pendingAction);
  }

  // Determine which actions are available for the current status
  const canSuspend  = currentStatus === 'active' || currentStatus === 'inactive';
  const canReinstate = currentStatus === 'suspended';
  const canGraduate  = currentStatus === 'active';
  const canArchive   = currentStatus === 'active' || currentStatus === 'inactive' || currentStatus === 'suspended';

  if (isTerminal) return null;

  const reasonRequired = pendingAction === 'suspend' || pendingAction === 'archive';

  const DIALOG_CONTENT: Record<
    NonNullable<PendingAction>,
    { title: string; description: string }
  > = {
    suspend:   {
      title:       'Suspend Student',
      description: 'The student will be marked as suspended and will not appear in active lists.',
    },
    reinstate: {
      title:       'Reinstate Student',
      description: 'The student will be returned to active status.',
    },
    graduate:  {
      title:       'Mark as Graduated',
      description: 'This marks the student as graduated. This action cannot be undone.',
    },
    archive:   {
      title:       'Archive Student Record',
      description: 'The student record will be archived. This is a terminal state.',
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1">
            Actions
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canSuspend && (
            <DropdownMenuItem
              className="text-orange-600 focus:text-orange-600"
              onClick={() => setPendingAction('suspend')}
            >
              <AlertCircle size={15} className="mr-2" />
              Suspend
            </DropdownMenuItem>
          )}
          {canReinstate && (
            <DropdownMenuItem
              className="text-teal-600 focus:text-teal-600"
              onClick={() => setPendingAction('reinstate')}
            >
              <UserCheck size={15} className="mr-2" />
              Reinstate
            </DropdownMenuItem>
          )}
          {canGraduate && (
            <DropdownMenuItem
              className="text-purple-600 focus:text-purple-600"
              onClick={() => setPendingAction('graduate')}
            >
              <GraduationCap size={15} className="mr-2" />
              Mark as Graduated
            </DropdownMenuItem>
          )}
          {(canSuspend || canReinstate || canGraduate) && canArchive && (
            <DropdownMenuSeparator />
          )}
          {canArchive && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setPendingAction('archive')}
            >
              <Archive size={15} className="mr-2" />
              Archive Record
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation dialog */}
      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && handleCloseDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction ? DIALOG_CONTENT[pendingAction].title : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction ? DIALOG_CONTENT[pendingAction].description : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {reasonRequired && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="lifecycle-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="lifecycle-reason"
                placeholder="Enter reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={mutation.isPending || (reasonRequired && !reason.trim())}
              className={
                pendingAction === 'archive'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {mutation.isPending ? 'Processing…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
