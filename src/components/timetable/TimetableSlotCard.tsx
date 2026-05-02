import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Lock, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TimetableSlot } from '@/types/timetable';
import { SlotEditDialog } from './SlotEditDialog';

// 12-color palette keyed by subject index (assigned at render time)
const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-rose-100 text-rose-800 border-rose-200',
];

// Module-level color index cache (reset on page navigation)
const colorIndexCache = new Map<number, number>();
let nextColorIndex = 0;

function getSubjectColor(subjectId: number): string {
  if (!colorIndexCache.has(subjectId)) {
    colorIndexCache.set(subjectId, nextColorIndex % SUBJECT_COLORS.length);
    nextColorIndex++;
  }
  return SUBJECT_COLORS[colorIndexCache.get(subjectId)!];
}

interface Props {
  slot: TimetableSlot;
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  timetableId: string;
  onUpdated: (slot: TimetableSlot) => void;
  classSize: number;
  schoolId: number;
}

export const TimetableSlotCard = ({
  slot,
  hasHardConflict,
  hasSoftConflict,
  timetableId,
  onUpdated,
  classSize,
  schoolId,
}: Props) => {
  const [editOpen, setEditOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: slot.id,
    disabled: slot.is_locked,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  const colorClass = slot.subject_id ? getSubjectColor(slot.subject_id) : 'bg-muted text-muted-foreground border-border';
  const borderOverride = hasHardConflict
    ? 'border-red-500 ring-1 ring-red-400'
    : hasSoftConflict
    ? 'border-amber-400 ring-1 ring-amber-300'
    : '';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...(slot.is_locked ? {} : { ...listeners, ...attributes })}
        className={`
          relative rounded border px-2 py-1 text-xs cursor-${slot.is_locked ? 'default' : 'grab'}
          select-none min-h-[56px] flex flex-col gap-0.5
          ${colorClass} ${borderOverride}
          ${isDragging ? 'opacity-50 shadow-lg' : ''}
        `}
      >
        {/* Subject name */}
        <div className="font-semibold leading-tight truncate">
          {slot.subject?.name ?? '—'}
        </div>

        {/* Teacher */}
        {slot.teacher && (
          <div className="text-[10px] leading-tight truncate opacity-80">
            {slot.isSubstituted ? (
              <span className="text-yellow-700 font-medium">
                {slot.teacher.first_name} {slot.teacher.last_name}
              </span>
            ) : (
              `${slot.teacher.first_name} ${slot.teacher.last_name}`
            )}
          </div>
        )}

        {/* Special room */}
        {slot.special_room && (
          <div className="text-[10px] opacity-70 truncate">{slot.special_room.name}</div>
        )}

        {/* Badges row */}
        <div className="flex items-center gap-1 mt-auto">
          {slot.is_locked && <Lock className="h-3 w-3 opacity-60 flex-shrink-0" />}
          {slot.isSubstituted && (
            <Badge className="h-3.5 px-1 text-[9px] bg-yellow-400 text-yellow-900 hover:bg-yellow-400">SUB</Badge>
          )}
        </div>

        {/* Edit menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute top-0.5 right-0.5 opacity-0 hover:opacity-100 group-hover:opacity-100 p-0.5 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit slot</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editOpen && (
        <SlotEditDialog
          slot={slot}
          timetableId={timetableId}
          classSize={classSize}
          schoolId={schoolId}
          onUpdated={(updated) => { onUpdated(updated); setEditOpen(false); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
};
