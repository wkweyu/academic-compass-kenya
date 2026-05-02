import { AlertTriangle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { TimetableConflict } from '@/types/timetable';

interface Props {
  conflicts: TimetableConflict[];
  onDismissSoft: () => void;
}

const CONFLICT_LABELS: Record<string, string> = {
  teacher_overlap: 'Teacher double-booked',
  special_room_overlap: 'Room double-booked',
  double_not_consecutive: 'Double lesson not consecutive',
  subject_spread: 'Subject bunched on same day',
  teacher_overload: 'Teacher overloaded',
  idle_gap: 'Teacher idle gap',
};

export const ConflictBanner = ({ conflicts, onDismissSoft }: Props) => {
  const hardConflicts = conflicts.filter((c) => c.severity === 'hard');
  const softConflicts = conflicts.filter((c) => c.severity === 'soft');

  return (
    <div className="space-y-2">
      {hardConflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{hardConflicts.length} hard conflict{hardConflicts.length > 1 ? 's' : ''}:</strong>{' '}
            {[...new Set(hardConflicts.map((c) => CONFLICT_LABELS[c.type] ?? c.type))].join(', ')}. Must be resolved before publishing.
          </AlertDescription>
        </Alert>
      )}

      {softConflicts.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong>{softConflicts.length} soft conflict{softConflicts.length > 1 ? 's' : ''}:</strong>{' '}
              {[...new Set(softConflicts.map((c) => CONFLICT_LABELS[c.type] ?? c.type))].join(', ')}.
            </span>
            <Button variant="ghost" size="sm" className="ml-2 h-6 px-2 text-amber-900" onClick={onDismissSoft}>
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
