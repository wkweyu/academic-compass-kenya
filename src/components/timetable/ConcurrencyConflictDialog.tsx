import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onReload: () => void;
}

export const ConcurrencyConflictDialog = ({ open, onReload }: Props) => (
  <AlertDialog open={open}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Conflict Detected</AlertDialogTitle>
        <AlertDialogDescription>
          Your changes were not saved — another user has edited this timetable since you loaded it.
          Reload to see the current version before making further changes.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction onClick={onReload}>Reload Timetable</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
