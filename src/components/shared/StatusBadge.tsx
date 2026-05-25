import { STUDENT_STATUS_OPTIONS } from '@/types/student';
import type { Student } from '@/types/student';

interface StatusBadgeProps {
  status: Student['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const option = STUDENT_STATUS_OPTIONS.find((o) => o.value === status);
  const label = option?.label ?? status;
  const colorClass = option?.color ?? 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}
