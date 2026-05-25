import { useQuery } from '@tanstack/react-query';
import { getAcademicHistory } from '@/services/studentHistoryService';
import { AcademicHistoryEventType } from '@/types/student';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, ArrowRight, ArrowLeftRight, AlertCircle, CheckCircle2, Archive, UserCheck } from 'lucide-react';

interface AcademicHistoryTabProps {
  studentId: string;
}

const EVENT_CONFIG: Record<
  AcademicHistoryEventType,
  { label: string; color: string; icon: React.ElementType }
> = {
  admission:      { label: 'Admitted',     color: 'bg-green-100 text-green-800 border-green-200',   icon: CheckCircle2   },
  promotion:      { label: 'Promoted',     color: 'bg-blue-100 text-blue-800 border-blue-200',      icon: ArrowRight     },
  transfer:       { label: 'Transferred',  color: 'bg-amber-100 text-amber-800 border-amber-200',   icon: ArrowLeftRight },
  suspension:     { label: 'Suspended',    color: 'bg-red-100 text-red-800 border-red-200',         icon: AlertCircle    },
  reinstatement:  { label: 'Reinstated',   color: 'bg-teal-100 text-teal-800 border-teal-200',      icon: UserCheck      },
  graduation:     { label: 'Graduated',    color: 'bg-purple-100 text-purple-800 border-purple-200',icon: GraduationCap  },
  archival:       { label: 'Archived',     color: 'bg-gray-100 text-gray-700 border-gray-200',      icon: Archive        },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function AcademicHistoryTab({ studentId }: AcademicHistoryTabProps) {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['student-academic-history', studentId],
    queryFn: () => getAcademicHistory(studentId),
    enabled: !!studentId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading academic history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive text-sm">
        Failed to load academic history.
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GraduationCap size={48} className="mx-auto mb-4 opacity-40" />
        <p>No academic history recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-3 bottom-3 w-px bg-border" aria-hidden />

      <ol className="space-y-6">
        {events.map((event) => {
          const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.admission;
          const Icon = cfg.icon;

          return (
            <li key={event.id} className="relative flex gap-4 pl-12">
              {/* Circle on timeline */}
              <div
                className={`absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background ${cfg.color}`}
                aria-hidden
              >
                <Icon size={18} />
              </div>

              <div className="flex-1 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <Badge className={`text-xs font-medium border ${cfg.color}`}>
                    {cfg.label}
                  </Badge>
                  <time className="text-xs text-muted-foreground">
                    {formatDate(event.date)}
                  </time>
                </div>

                {(event.from || event.to) && (
                  <p className="text-sm mt-1">
                    {event.from && (
                      <span className="text-muted-foreground">
                        From <strong className="text-foreground">{event.from}</strong>
                      </span>
                    )}
                    {event.from && event.to && (
                      <ArrowRight size={14} className="inline mx-1 text-muted-foreground" />
                    )}
                    {event.to && (
                      <span className="text-muted-foreground">
                        To <strong className="text-foreground">{event.to}</strong>
                      </span>
                    )}
                  </p>
                )}

                {event.notes && (
                  <p className="text-sm text-muted-foreground mt-1">{event.notes}</p>
                )}

                {event.performedBy && (
                  <p className="text-xs text-muted-foreground mt-2">
                    By: {event.performedBy}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
