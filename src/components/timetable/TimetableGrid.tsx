import { useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { timetableService } from '@/services/timetableService';
import type { TimetableSlot, TimetableConflict, SchoolPeriod, SchoolDay } from '@/types/timetable';
import { makeTeacherDisplayMap } from '@/utils/timetableFormatters';
import { TimetableSlotCard } from './TimetableSlotCard';
import { useToast } from '@/hooks/use-toast';

interface Props {
  slots: TimetableSlot[];
  timetableId: string;
  onSlotUpdated: (slot: TimetableSlot) => void;
  conflicts: TimetableConflict[];
  classSize: number;
  schoolId: number;
  /** Authoritative ordered period list fetched from API */
  periods: SchoolPeriod[];
  /** Authoritative ordered day list fetched from API */
  days: SchoolDay[];
  printMeta?: {
    schoolName?: string;
    className: string;
    streamName?: string | null;
    term: number;
    year: number;
    generatedAt?: string | null;
  };
}

export const TimetableGrid = ({
  slots, timetableId, onSlotUpdated, conflicts,
  classSize, schoolId, periods, days, printMeta,
}: Props) => {
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // Build teacher display codes once per render — shared with all slot cards
  const teacherDisplayMap = useMemo(() => makeTeacherDisplayMap(slots), [slots]);

  const getSlot = (day: number, periodId: string) =>
    slots.find((s) => s.day_of_week === day && s.period_id === periodId) ?? null;

  const conflictSlotIds = new Set(conflicts.flatMap((c) => c.affectedSlotIds));
  const hardConflictIds = new Set(
    conflicts.filter((c) => c.severity === 'hard').flatMap((c) => c.affectedSlotIds)
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromSlot = slots.find((s) => s.id === String(active.id));
      const toKey = String(over.id); // format: `${day}_${periodId}`
      const [dayStr, periodId] = toKey.split('_');
      const toDay = Number(dayStr);

      if (!fromSlot || !periodId || !toDay) return;
      if (fromSlot.is_locked) return;

      // Guard: reject drops onto break periods
      const targetPeriod = periods.find((p) => p.id === periodId);
      if (!targetPeriod || targetPeriod.is_break) return;

      const occupyingSlot = getSlot(toDay, periodId);

      try {
        if (occupyingSlot && !occupyingSlot.is_locked) {
          // Swap
          const [updated1, updated2] = await Promise.all([
            timetableService.updateSlot(fromSlot.id, { day_of_week: toDay as any, period_id: periodId }, fromSlot.updated_at),
            timetableService.updateSlot(occupyingSlot.id, { day_of_week: fromSlot.day_of_week, period_id: fromSlot.period_id }, occupyingSlot.updated_at),
          ]);
          onSlotUpdated(updated1);
          onSlotUpdated(updated2);
        } else if (!occupyingSlot) {
          // Move to empty cell
          const updated = await timetableService.updateSlot(
            fromSlot.id,
            { day_of_week: toDay as any, period_id: periodId },
            fromSlot.updated_at
          );
          onSlotUpdated(updated);
        }
      } catch (err: any) {
        toast({ title: 'Move failed', description: err.message, variant: 'destructive' });
      }
    },
    [slots, periods, onSlotUpdated, toast]
  );

  // Empty state guards
  if (periods.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No periods configured. Go to the <strong>Periods &amp; Calendar</strong> tab to set them up.
      </p>
    );
  }
  if (days.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No school days configured.
      </p>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Print-only header — hidden on screen */}
      {printMeta && (
        <div className="hidden print:block mb-4 text-center space-y-1">
          {printMeta.schoolName && (
            <div className="text-lg font-bold">{printMeta.schoolName}</div>
          )}
          <div className="text-base font-semibold">
            {printMeta.className}
            {printMeta.streamName ? ` · ${printMeta.streamName}` : ''}
            {' · '}Term {printMeta.term}, {printMeta.year}
          </div>
          {printMeta.generatedAt && (
            <div className="text-xs text-gray-500">
              Generated: {new Date(printMeta.generatedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto print:overflow-visible">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-border bg-muted px-3 py-2 text-left font-medium w-28">Period</th>
              {days.map((d) => (
                <th key={d.day_of_week} className="border border-border bg-muted px-3 py-2 text-center font-medium min-w-[130px]">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              if (period.is_break) {
                return (
                  <tr key={period.id} className="bg-muted/50">
                    <td className="border border-border px-3 py-1 font-medium text-xs whitespace-nowrap">
                      <div>{period.name}</div>
                      <div className="text-[10px] text-muted-foreground">{period.start_time}–{period.end_time}</div>
                    </td>
                    <td
                      colSpan={days.length}
                      className="border border-border px-3 py-1 text-center text-xs text-muted-foreground italic"
                    >
                      {period.name}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={period.id}>
                  <td className="border border-border px-3 py-1 font-medium text-xs whitespace-nowrap">
                    <div>{period.name}</div>
                    <div className="text-[10px] text-muted-foreground">{period.start_time}–{period.end_time}</div>
                  </td>
                  {days.map((d) => {
                    const slot = getSlot(d.day_of_week, period.id);
                    const cellId = `${d.day_of_week}_${period.id}`;
                    return (
                      <td
                        key={d.day_of_week}
                        className="border border-border px-1 py-1 align-top"
                        data-droppable-id={cellId}
                      >
                        {slot ? (
                          <TimetableSlotCard
                            slot={slot}
                            hasHardConflict={hardConflictIds.has(slot.id)}
                            hasSoftConflict={conflictSlotIds.has(slot.id) && !hardConflictIds.has(slot.id)}
                            timetableId={timetableId}
                            onUpdated={onSlotUpdated}
                            classSize={classSize}
                            schoolId={schoolId}
                            teacherCode={teacherDisplayMap.get(slot.teacher_id ?? -1)}
                          />
                        ) : (
                          <div
                            id={cellId}
                            className="h-14 rounded border-2 border-dashed border-border/30 hover:border-primary/40 transition-colors"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
};

