// Timetable Module Types

export interface SchoolPeriod {
  id: string;
  school_id: number;
  name: string;
  start_time: string; // "HH:MM"
  end_time: string;
  order_index: number;
  is_break: boolean;
  // is_double intentionally omitted: periods are atomic WHEN-slots only.
  // Double-period scheduling logic lives in class_subjects.is_double.
  days_of_week: number[]; // 1=Mon … 5=Fri
  created_at: string;
}

export interface SpecialRoom {
  id: string;
  school_id: number;
  name: string;
  capacity: number;
  room_type: 'lab' | 'computer' | 'hall' | 'library' | 'other';
  is_shared: boolean;
  is_active: boolean;
  created_at: string;
}

export interface SchoolCalendarEvent {
  id: string;
  school_id: number;
  title: string;
  event_type: 'holiday' | 'exam_period' | 'school_event' | 'closure';
  start_date: string; // ISO date
  end_date: string;
  affects_all_classes: boolean;
  affected_class_ids: number[] | null;
  affected_period_ids: string[] | null; // null = all periods on date range
  academic_year: number;
  term: 1 | 2 | 3 | null;
  created_at: string;
}

export type TimetableStatus = 'staging' | 'draft' | 'published' | 'archived';

export interface Timetable {
  id: string;
  school_id: number;
  class_id: number;
  stream_id: number | null;
  academic_year: number;
  term: 1 | 2 | 3;
  status: TimetableStatus;
  version: number;
  parent_version_id: string | null;
  generated_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string; // used for optimistic locking
  generation_id?: string | null;
  // joined
  class?: { id: number; name: string; grade_level: string };
  stream?: { id: number; name: string } | null;
}

export interface TimetableSlot {
  id: string;
  timetable_id: string;
  period_id: string;
  day_of_week: 1 | 2 | 3 | 4 | 5;
  subject_id: number | null;
  teacher_id: number | null;
  special_room_id: string | null;
  is_locked: boolean;
  notes: string | null;
  updated_at: string;
  // joined
  period?: SchoolPeriod;
  subject?: { id: number; name: string; code: string };
  teacher?: { id: number; first_name: string; last_name: string; employee_no?: string };
  special_room?: SpecialRoom | null;
  // overlay flags (set by getEffectiveTimetable / getTeacherTimetable)
  isSubstituted?: boolean;
  substitutionId?: string;
}

export interface TimetableSubstitution {
  id: string;
  timetable_id: string;
  slot_id: string;
  date: string; // ISO date
  original_teacher_id: number;
  substitute_teacher_id: number;
  subject_id: number;
  reason: string | null;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  created_by: string | null;
  notified_at: string | null;
  created_at: string;
  // joined
  slot?: TimetableSlot;
  original_teacher?: { id: number; first_name: string; last_name: string };
  substitute_teacher?: { id: number; first_name: string; last_name: string };
  subject?: { id: number; name: string };
}

export interface TimetableAuditLog {
  id: string;
  timetable_id: string;
  action: string;
  user_id: string;
  timestamp: string;
  changes: Record<string, { before: unknown; after: unknown }>;
}

// ============================================================
// Conflict Types
// ============================================================

export type TimetableConflictType =
  | 'teacher_overlap'
  | 'special_room_overlap'
  | 'double_not_consecutive'
  | 'subject_spread'
  | 'teacher_overload'
  | 'idle_gap';

export interface TimetableConflict {
  type: TimetableConflictType;
  severity: 'hard' | 'soft';
  day: number;
  periodId: string;
  description: string;
  affectedSlotIds: string[];
}

// ============================================================
// Scheduling / Generation
// ============================================================

export interface ConstraintWeights {
  idle_gap: number;          // default 15
  teacher_overload: number;  // default 8
  subject_spread: number;    // default 10 same-day, 5 back-to-back
}

export interface SchedulingConstraints {
  avoidBackToBack: boolean;
  evenDistribution: boolean;
  maxPeriodsPerDay: number;
  maxPeriodsPerWeek: number | null;
  regenerateScope: 'full' | 'day' | 'subject';
  scopeTarget?: number | string; // day 1-5 or subject_id
  maxBacktrackSteps?: number;    // default 1000
  constraintWeights?: Partial<ConstraintWeights>;
}

export interface ClassSubjectForGenerator {
  id: number;
  class_id: number;
  stream_id: number | null;
  subject_id: number;
  teacher_id: number | null;
  periods_per_week: number;
  is_double: boolean;
  requires_special_room: boolean;
  preferred_room_type: 'lab' | 'computer' | 'hall' | 'library' | 'other' | null;
  priority: number;
  subject: { id: number; name: string; code: string };
  teacher: { id: number; first_name: string; last_name: string } | null;
}

export interface GenerationResult {
  slots: TimetableSlot[];
  conflicts: TimetableConflict[];
  unassigned: (ClassSubjectForGenerator & {
    reason: 'no_valid_slot' | 'backtrack_limit' | 'no_room_capacity';
  })[];
  feasibilityError?: { required: number; available: number };
  timedOut?: boolean;
  timedOutReason?: 'elapsed' | 'predicted';
  seed?: number;
}

// ============================================================
// School-wide Generation
// ============================================================

export type FeasibilityLevel = 'ok' | 'tight' | 'impossible';

export interface UnassignedSubject {
  subjectId: number;
  subjectName: string;
  teacherId?: number;
  reason: 'no_valid_slot' | 'backtrack_limit' | 'no_room_capacity' | 'exhausted_attempts' | 'starvation' | 'timeout';
}

export interface ClassGenerationResult {
  classId: number;
  streamId: number | null;
  className: string;
  streamName?: string;
  feasibility: FeasibilityLevel;
  feasibilityError?: { required: number; available: number };
  slots: TimetableSlot[];
  conflicts: TimetableConflict[];
  unassigned: UnassignedSubject[];
  slotsFilled: number;
  slotsRequired: number;
}

export interface SchoolGenerationResult {
  results: ClassGenerationResult[];
  globalConflicts: TimetableConflict[];
  executionTime: number;
  timedOut: boolean;
  timedOutReason?: 'elapsed' | 'predicted';
  seed: number;
}

// ============================================================
// Occupancy / Load Maps (used in generator)
// ============================================================

/** key: `${teacherId}_${day}_${periodId}` */
export type TeacherOccupancyMap = Map<string, boolean>;

/** key: `${roomId}_${day}_${periodId}` */
export type SpecialRoomOccupancyMap = Map<string, boolean>;

/** key: subject_id — tracks how many slots assigned so far */
export type AssignedCountMap = Map<number, number>;

/** key: teacher_id — existing weekly load before this generation */
export type TeacherWeeklyLoadMap = Map<number, number>;

/** key: room_id — how many slots this room is used this term */
export type RoomUsageCountMap = Map<string, number>;

// ============================================================
// View helpers
// ============================================================

/** Keyed by day (1-5) → period id → slot or null */
export type WeeklyGrid = Record<number, Record<string, TimetableSlot | null>>;

export interface BlackoutSlot {
  date: Date;
  periodIds: string[] | null; // null = all periods
}
