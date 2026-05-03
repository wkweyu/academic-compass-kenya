import { supabase } from '@/integrations/supabase/client';
import type {
  SchoolPeriod,
  SchoolDay,
  SpecialRoom,
  SchoolCalendarEvent,
  Timetable,
  TimetableSlot,
  TimetableSubstitution,
  TimetableAuditLog,
  BlackoutSlot,
  SchedulingConstraints,
  GenerationResult,
  SchoolGenerationResult,
  ClassGenerationResult,
} from '@/types/timetable';

// ============================================================
// Error helpers
// ============================================================

export class ConcurrencyConflictError extends Error {
  constructor() {
    super('Timetable was modified by another user. Please reload before saving.');
    this.name = 'ConcurrencyConflictError';
  }
}

// ============================================================
// School Periods
// ============================================================

export const timetableService = {
  async getSchoolPeriods(schoolId: number): Promise<SchoolPeriod[]> {
    const { data, error } = await supabase
      .from('school_periods')
      .select('*')
      .eq('school_id', schoolId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return (data || []) as SchoolPeriod[];
  },

  async upsertSchoolPeriod(period: Partial<SchoolPeriod> & { school_id: number }): Promise<SchoolPeriod> {
    const { data, error } = await supabase
      .from('school_periods')
      .upsert(period)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolPeriod;
  },

  async deleteSchoolPeriod(id: string): Promise<void> {
    const { error } = await supabase.from('school_periods').delete().eq('id', id);
    if (error) throw error;
  },

  async reorderPeriods(schoolId: number, orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({
      id,
      school_id: schoolId,
      order_index: index,
    }));
    const { error } = await supabase.from('school_periods').upsert(updates, { onConflict: 'id' });
    if (error) throw error;
  },

  // ============================================================
  // School Days
  // ============================================================

  async getSchoolDays(schoolId: number): Promise<SchoolDay[]> {
    const { data, error } = await supabase
      .from('school_days')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('order_index', { ascending: true })
      .order('day_of_week', { ascending: true }); // tiebreaker — stable sort
    if (error) throw error;
    if (!data || data.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[timetableService] getSchoolDays: school ${schoolId} has no configured days — using Mon-Fri fallback`
        );
      }
      return [
        { id: '1', school_id: schoolId, day_of_week: 1, name: 'Monday',    short_name: 'Mon', order_index: 0, is_active: true },
        { id: '2', school_id: schoolId, day_of_week: 2, name: 'Tuesday',   short_name: 'Tue', order_index: 1, is_active: true },
        { id: '3', school_id: schoolId, day_of_week: 3, name: 'Wednesday', short_name: 'Wed', order_index: 2, is_active: true },
        { id: '4', school_id: schoolId, day_of_week: 4, name: 'Thursday',  short_name: 'Thu', order_index: 3, is_active: true },
        { id: '5', school_id: schoolId, day_of_week: 5, name: 'Friday',    short_name: 'Fri', order_index: 4, is_active: true },
      ];
    }
    return data as SchoolDay[];
  },

  // ============================================================
  // Special Rooms
  // ============================================================

  async getSpecialRooms(schoolId: number): Promise<SpecialRoom[]> {
    const { data, error } = await supabase
      .from('special_rooms')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as SpecialRoom[];
  },

  async upsertSpecialRoom(room: Partial<SpecialRoom> & { school_id: number }): Promise<SpecialRoom> {
    const { data, error } = await supabase
      .from('special_rooms')
      .upsert(room)
      .select()
      .single();
    if (error) throw error;
    return data as SpecialRoom;
  },

  async deleteSpecialRoom(id: string): Promise<void> {
    // Soft-delete: mark inactive so existing slots keep the FK
    const { error } = await supabase
      .from('special_rooms')
      .update({ is_active: false })
      .eq('id', id);
    if (error) throw error;
  },

  // ============================================================
  // Calendar Events
  // ============================================================

  async getCalendarEvents(
    schoolId: number,
    academicYear: number,
    term?: 1 | 2 | 3
  ): Promise<SchoolCalendarEvent[]> {
    let query = supabase
      .from('school_calendar_events')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year', academicYear)
      .order('start_date', { ascending: true });

    if (term) query = query.or(`term.eq.${term},term.is.null`);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as SchoolCalendarEvent[];
  },

  async upsertCalendarEvent(
    event: Partial<SchoolCalendarEvent> & { school_id: number }
  ): Promise<SchoolCalendarEvent> {
    const { data, error } = await supabase
      .from('school_calendar_events')
      .upsert(event)
      .select()
      .single();
    if (error) throw error;
    return data as SchoolCalendarEvent;
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    const { error } = await supabase.from('school_calendar_events').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Returns per-date blackout info with optional period granularity.
   * null periodIds = entire day blocked; string[] = only those periods.
   */
  async getBlackoutSlots(
    schoolId: number,
    academicYear: number,
    term: 1 | 2 | 3
  ): Promise<BlackoutSlot[]> {
    const events = await this.getCalendarEvents(schoolId, academicYear, term);
    const slots: BlackoutSlot[] = [];

    for (const event of events) {
      const start = new Date(event.start_date);
      const end = new Date(event.end_date);
      const cursor = new Date(start);
      while (cursor <= end) {
        slots.push({
          date: new Date(cursor),
          periodIds: event.affected_period_ids ?? null,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return slots;
  },

  // ============================================================
  // Timetables
  // ============================================================

  async getTimetable(
    classId: number,
    streamId: number | null,
    term: 1 | 2 | 3,
    year: number,
    version?: number
  ): Promise<Timetable | null> {
    let query = supabase
      .from('timetables')
      .select('*, class:classes(id,name,grade_level), stream:streams(id,name)')
      .eq('class_id', classId)
      .eq('term', term)
      .eq('academic_year', year)
      .neq('status', 'archived');

    if (streamId) query = query.eq('stream_id', streamId);
    else query = query.is('stream_id', null);

    if (version) {
      query = query.eq('version', version);
    } else {
      query = query.order('version', { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data as Timetable | null;
  },

  async getTimetableVersions(
    classId: number,
    streamId: number | null,
    term: 1 | 2 | 3,
    year: number
  ): Promise<Timetable[]> {
    let query = supabase
      .from('timetables')
      .select('id, version, status, created_at, updated_at, generated_at, published_at, parent_version_id')
      .eq('class_id', classId)
      .eq('term', term)
      .eq('academic_year', year)
      .order('version', { ascending: false });

    if (streamId) query = query.eq('stream_id', streamId);
    else query = query.is('stream_id', null);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Timetable[];
  },

  async duplicateTimetable(timetableId: string): Promise<Timetable> {
    // Fetch original
    const { data: original, error: fetchError } = await supabase
      .from('timetables')
      .select('*')
      .eq('id', timetableId)
      .single();
    if (fetchError) throw fetchError;

    // Get max version for this class/stream/term/year
    let vq = supabase
      .from('timetables')
      .select('version')
      .eq('class_id', original.class_id)
      .eq('term', original.term)
      .eq('academic_year', original.academic_year)
      .order('version', { ascending: false })
      .limit(1);

    if (original.stream_id) vq = vq.eq('stream_id', original.stream_id);
    else vq = vq.is('stream_id', null);

    const { data: versionRows } = await vq;
    const nextVersion = ((versionRows?.[0]?.version) ?? 0) + 1;

    // Create new draft
    const { data: newTimetable, error: insertError } = await supabase
      .from('timetables')
      .insert({
        school_id: original.school_id,
        class_id: original.class_id,
        stream_id: original.stream_id,
        academic_year: original.academic_year,
        term: original.term,
        status: 'draft',
        version: nextVersion,
        parent_version_id: timetableId,
      })
      .select()
      .single();
    if (insertError) throw insertError;

    // Copy slots
    const { data: slots, error: slotsError } = await supabase
      .from('timetable_slots')
      .select('period_id, day_of_week, subject_id, teacher_id, special_room_id, is_locked, notes')
      .eq('timetable_id', timetableId);
    if (slotsError) throw slotsError;

    if (slots && slots.length > 0) {
      const newSlots = slots.map((s: any) => ({ ...s, timetable_id: newTimetable.id }));
      const { error: copyError } = await supabase.from('timetable_slots').insert(newSlots);
      if (copyError) throw copyError;
    }

    // Audit
    await this._insertAuditLog(newTimetable.id, 'version_duplicated', {
      parent_version_id: { before: null, after: timetableId },
      version: { before: null, after: nextVersion },
    });

    return newTimetable as Timetable;
  },

  /**
   * Bulk-save slots with optimistic locking.
   * Throws ConcurrencyConflictError if the timetable was updated since it was loaded.
   * Skips is_locked=true slots.
   */
  async saveTimetableSlots(
    timetableId: string,
    slots: Partial<TimetableSlot>[],
    expectedUpdatedAt: string
  ): Promise<void> {
    // Optimistic lock check
    const { data: current, error: lockError } = await supabase
      .from('timetables')
      .select('updated_at')
      .eq('id', timetableId)
      .single();
    if (lockError) throw lockError;

    if (current.updated_at !== expectedUpdatedAt) {
      throw new ConcurrencyConflictError();
    }

    // Filter out locked slots
    const writableSlots = slots.filter((s) => !s.is_locked);
    if (writableSlots.length === 0) return;

    const upsertData = writableSlots.map((s) => ({ ...s, timetable_id: timetableId }));
    const { error } = await supabase
      .from('timetable_slots')
      .upsert(upsertData, { onConflict: 'timetable_id,period_id,day_of_week' });
    if (error) throw error;

    // Bump updated_at
    await supabase
      .from('timetables')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', timetableId);
  },

  async updateSlot(
    slotId: string,
    patch: Partial<TimetableSlot>,
    expectedUpdatedAt: string
  ): Promise<TimetableSlot> {
    // Check slot-level optimistic lock
    const { data: current, error: lockError } = await supabase
      .from('timetable_slots')
      .select('updated_at, is_locked')
      .eq('id', slotId)
      .single();
    if (lockError) throw lockError;

    if (current.updated_at !== expectedUpdatedAt) {
      throw new ConcurrencyConflictError();
    }
    if (current.is_locked) {
      throw new Error('This slot is locked and cannot be edited.');
    }

    const { data, error } = await supabase
      .from('timetable_slots')
      .update(patch)
      .eq('id', slotId)
      .select('*, period:school_periods(*), subject:subjects(id,name,code), teacher:teachers(id,first_name,last_name), special_room:special_rooms(*)')
      .single();
    if (error) throw error;
    return data as TimetableSlot;
  },

  async publishTimetable(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetables')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await this._insertAuditLog(id, 'timetable_published', {
      status: { before: 'draft', after: 'published' },
    });
  },

  async unpublishTimetable(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetables')
      .update({ status: 'draft', published_at: null })
      .eq('id', id);
    if (error) throw error;
  },

  async archiveTimetable(id: string): Promise<void> {
    const { error } = await supabase
      .from('timetables')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) throw error;
  },

  // ============================================================
  // View Queries
  // ============================================================

  async getTimetableSlots(timetableId: string): Promise<TimetableSlot[]> {
    const { data, error } = await supabase
      .from('timetable_slots')
      .select(`
        *,
        period:school_periods(*),
        subject:subjects(id,name,code),
        teacher:teachers(id,first_name,last_name,employee_no),
        special_room:special_rooms(*)
      `)
      .eq('timetable_id', timetableId)
      .order('day_of_week', { ascending: true });
    if (error) throw error;
    return (data || []) as TimetableSlot[];
  },

  /**
   * Returns slots with active substitutions overlaid for the given date.
   * Substituted slots have isSubstituted=true and show the substitute teacher.
   */
  async getEffectiveTimetable(
    classId: number,
    streamId: number | null,
    term: 1 | 2 | 3,
    year: number,
    date: Date
  ): Promise<TimetableSlot[]> {
    const timetable = await this.getTimetable(classId, streamId, term, year);
    if (!timetable) return [];

    const slots = await this.getTimetableSlots(timetable.id);
    const dateStr = date.toISOString().split('T')[0];

    // Fetch active substitutions for this date
    const { data: subs, error } = await supabase
      .from('timetable_substitutions')
      .select('*, substitute_teacher:teachers!substitute_teacher_id(id,first_name,last_name)')
      .eq('timetable_id', timetable.id)
      .eq('date', dateStr)
      .in('status', ['pending', 'active']);
    if (error) throw error;

    const subsBySlot = new Map<string, any>();
    for (const sub of (subs || [])) {
      subsBySlot.set(sub.slot_id, sub);
    }

    return slots.map((slot) => {
      const sub = subsBySlot.get(slot.id);
      if (!sub) return slot;
      return {
        ...slot,
        teacher_id: sub.substitute_teacher_id,
        teacher: sub.substitute_teacher,
        isSubstituted: true,
        substitutionId: sub.id,
      };
    });
  },

  /**
   * Returns a teacher's weekly schedule, optionally date-aware.
   * When date provided: removes absent slots, adds substitute slots.
   */
  async getTeacherTimetable(
    teacherId: number,
    term: 1 | 2 | 3,
    year: number,
    date?: Date
  ): Promise<TimetableSlot[]> {
    const { data: schoolIdRow } = await supabase.rpc('get_user_school_id');
    const schoolId = schoolIdRow;

    // Get all published timetable ids for this school/term/year
    const { data: timetables, error: ttError } = await supabase
      .from('timetables')
      .select('id')
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', year)
      .eq('status', 'published');
    if (ttError) throw ttError;

    const timetableIds = (timetables || []).map((t: any) => t.id);
    if (timetableIds.length === 0) return [];

    const { data, error } = await supabase
      .from('timetable_slots')
      .select(`
        *,
        period:school_periods(*),
        subject:subjects(id,name,code),
        teacher:teachers(id,first_name,last_name),
        special_room:special_rooms(*),
        timetable:timetables(id,class_id,stream_id,class:classes(id,name),stream:streams(id,name))
      `)
      .in('timetable_id', timetableIds)
      .eq('teacher_id', teacherId);
    if (error) throw error;

    let slots: TimetableSlot[] = (data || []) as TimetableSlot[];

    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      // Fetch substitutions for this date involving this teacher
      const { data: subs } = await supabase
        .from('timetable_substitutions')
        .select('*, substitute_teacher:teachers!substitute_teacher_id(id,first_name,last_name)')
        .in('timetable_id', timetableIds)
        .eq('date', dateStr)
        .in('status', ['pending', 'active']);

      const absentSlotIds = new Set<string>();
      const substituteSlotIds = new Set<string>();
      for (const sub of (subs || [])) {
        if (sub.original_teacher_id === teacherId) absentSlotIds.add(sub.slot_id);
        if (sub.substitute_teacher_id === teacherId) substituteSlotIds.add(sub.slot_id);
      }

      // Remove absent slots, mark substitute slots
      slots = slots.filter((s) => !absentSlotIds.has(s.id));

      // Fetch substitute slots (slots this teacher is covering today)
      if (substituteSlotIds.size > 0) {
        const { data: subSlots } = await supabase
          .from('timetable_slots')
          .select(`
            *,
            period:school_periods(*),
            subject:subjects(id,name,code),
            teacher:teachers(id,first_name,last_name),
            special_room:special_rooms(*),
            timetable:timetables(id,class_id,stream_id,class:classes(id,name),stream:streams(id,name))
          `)
          .in('id', Array.from(substituteSlotIds));
        if (subSlots) {
          const subSlotsMapped = subSlots.map((s: any) => ({
            ...s,
            isSubstituted: true,
          }));
          slots = [...slots, ...subSlotsMapped];
        }
      }
    }

    return slots;
  },

  async getSpecialRoomTimetable(
    roomId: string,
    term: 1 | 2 | 3,
    year: number
  ): Promise<TimetableSlot[]> {
    const { data: schoolIdRow } = await supabase.rpc('get_user_school_id');
    const schoolId = schoolIdRow;

    const { data: timetables } = await supabase
      .from('timetables')
      .select('id')
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', year)
      .eq('status', 'published');

    const timetableIds = (timetables || []).map((t: any) => t.id);
    if (timetableIds.length === 0) return [];

    const { data, error } = await supabase
      .from('timetable_slots')
      .select(`
        *,
        period:school_periods(*),
        subject:subjects(id,name,code),
        teacher:teachers(id,first_name,last_name),
        timetable:timetables(id,class_id,stream_id,class:classes(id,name),stream:streams(id,name))
      `)
      .in('timetable_id', timetableIds)
      .eq('special_room_id', roomId);
    if (error) throw error;
    return (data || []) as TimetableSlot[];
  },

  async getAllPublishedTimetables(
    schoolId: number,
    term: 1 | 2 | 3,
    year: number
  ): Promise<Timetable[]> {
    const { data, error } = await supabase
      .from('timetables')
      .select('*, class:classes(id,name,grade_level), stream:streams(id,name)')
      .eq('school_id', schoolId)
      .eq('term', term)
      .eq('academic_year', year)
      .eq('status', 'published')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as Timetable[];
  },

  // ============================================================
  // Substitutions
  // ============================================================

  async getSubstitutions(
    schoolId: number,
    dateRange?: { from: string; to: string }
  ): Promise<TimetableSubstitution[]> {
    let query = supabase
      .from('timetable_substitutions')
      .select(`
        *,
        original_teacher:teachers!original_teacher_id(id,first_name,last_name),
        substitute_teacher:teachers!substitute_teacher_id(id,first_name,last_name),
        subject:subjects(id,name),
        slot:timetable_slots(id,day_of_week,period:school_periods(id,name))
      `)
      .eq('timetables.school_id', schoolId)
      .order('date', { ascending: false });

    if (dateRange) {
      query = query.gte('date', dateRange.from).lte('date', dateRange.to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TimetableSubstitution[];
  },

  async createSubstitution(sub: Omit<TimetableSubstitution, 'id' | 'created_at' | 'notified_at'>): Promise<TimetableSubstitution> {
    const { data, error } = await supabase
      .from('timetable_substitutions')
      .insert(sub)
      .select()
      .single();
    if (error) throw error;
    return data as TimetableSubstitution;
  },

  async updateSubstitutionStatus(
    id: string,
    status: TimetableSubstitution['status']
  ): Promise<void> {
    const { error } = await supabase
      .from('timetable_substitutions')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Returns teachers qualified for the subject who are free during the slot's period.
   * Excludes the original teacher.
   */
  async getQualifiedAvailableTeachers(
    schoolId: number,
    slotId: string,
    date: string,
    subjectId: number,
    originalTeacherId: number
  ): Promise<{ id: number; first_name: string; last_name: string; proficiency_level: string; is_primary: boolean }[]> {
    // Get subject specializations
    const { data: specs, error: specError } = await supabase
      .from('teacher_specializations')
      .select('teacher_id, proficiency_level, is_primary, teacher:teachers(id,first_name,last_name)')
      .eq('subject_id', subjectId)
      .neq('teacher_id', originalTeacherId);
    if (specError) throw specError;
    if (!specs || specs.length === 0) return [];

    const qualifiedIds = specs.map((s: any) => s.teacher_id);

    // Get the slot's period + day to check availability
    const { data: slot } = await supabase
      .from('timetable_slots')
      .select('period_id, day_of_week, timetable:timetables(term, academic_year)')
      .eq('id', slotId)
      .single();
    if (!slot) return [];

    const { term, academic_year } = (slot as any).timetable;

    // Check occupied slots for qualified teachers on that term/year
    const { data: occupied } = await supabase.rpc('get_teacher_occupied_slots', {
      teacher_ids: qualifiedIds,
      p_term: term,
      p_year: academic_year,
    });

    const busyKey = (tid: number) => `${tid}_${slot.day_of_week}_${slot.period_id}`;
    const busySet = new Set((occupied || []).map((o: any) => busyKey(o.teacher_id)));

    // Also check if already substituting that date
    const { data: dateSubs } = await supabase
      .from('timetable_substitutions')
      .select('substitute_teacher_id, slot:timetable_slots(period_id, day_of_week)')
      .eq('date', date)
      .in('substitute_teacher_id', qualifiedIds)
      .in('status', ['pending', 'active']);

    const dateSubBusy = new Set<string>();
    for (const ds of (dateSubs || [])) {
      const s = (ds as any).slot;
      if (s?.period_id === slot.period_id && s?.day_of_week === slot.day_of_week) {
        dateSubBusy.add(String(ds.substitute_teacher_id));
      }
    }

    return specs
      .filter((s: any) => !busySet.has(busyKey(s.teacher_id)) && !dateSubBusy.has(String(s.teacher_id)))
      .sort((a: any, b: any) => {
        if (b.is_primary !== a.is_primary) return b.is_primary ? 1 : -1;
        const levels: Record<string, number> = { expert: 3, advanced: 2, intermediate: 1, beginner: 0 };
        return (levels[b.proficiency_level] ?? 0) - (levels[a.proficiency_level] ?? 0);
      })
      .map((s: any) => ({
        id: s.teacher_id,
        first_name: s.teacher.first_name,
        last_name: s.teacher.last_name,
        proficiency_level: s.proficiency_level,
        is_primary: s.is_primary,
      }));
  },

  // ============================================================
  // Audit Logs
  // ============================================================

  async getAuditLog(timetableId: string, limit = 50): Promise<TimetableAuditLog[]> {
    const { data, error } = await supabase
      .from('timetable_audit_logs')
      .select('*')
      .eq('timetable_id', timetableId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []) as TimetableAuditLog[];
  },

  // ============================================================
  // Timetable Generation (calls Edge Function)
  // ============================================================

  async generateTimetable(
    classId: number,
    streamId: number | null,
    term: 1 | 2 | 3,
    year: number,
    constraints: SchedulingConstraints,
    preserveLocked: boolean
  ): Promise<GenerationResult> {
    const { data, error } = await supabase.functions.invoke('generate-timetable', {
      body: { classId, streamId, term, year, constraints, preserveLocked },
    });
    if (error) throw error;
    return data as GenerationResult;
  },

  async generateSchoolTimetable(
    schoolId: number,
    term: 1 | 2 | 3,
    year: number,
    constraints: SchedulingConstraints,
    preserveLocked: boolean,
    seed?: number
  ): Promise<SchoolGenerationResult> {
    const { data, error } = await supabase.functions.invoke('generate-timetable', {
      body: {
        mode: 'school',
        schoolId,
        term,
        year,
        constraints,
        preserveLocked,
        seed: seed ?? Date.now(),
      },
    });
    if (error) throw error;
    return data as SchoolGenerationResult;
  },

  /**
   * Two-phase save (spec §5.1):
   *   Phase 1 — upsert each class timetable as 'staging' + insert generated slots.
   *   Phase 2 — promote ALL to 'draft' atomically.
   * Rollback: if ANY step in Phase 1 or the Phase 2 UPDATE fails, ALL staging
   * rows for this generation_id are deleted (CASCADE removes their slots).
   * Idempotent: re-running with the same generation_id reuses existing staging
   * rows and replaces non-locked slots (spec §5.2).
   */
  async saveSchoolGeneratedTimetables(
    schoolId: number,
    term: 1 | 2 | 3,
    year: number,
    results: ClassGenerationResult[],
    generationId: string
  ): Promise<{ savedCount: number; timetableIds: string[] }> {
    const saveable = results.filter((r) => r.feasibility !== 'impossible' && r.slots.length > 0);
    const savedIds: string[] = [];

    // ── Phase 1: stage each class ───────────────────────────────────────────
    try {
      for (const result of saveable) {
        // Idempotency: find existing staging row for this generation_id
        let existQuery = supabase
          .from('timetables')
          .select('id')
          .eq('school_id', schoolId)
          .eq('class_id', result.classId)
          .eq('generation_id', generationId)
          .eq('term', term)
          .eq('academic_year', year);

        if (result.streamId !== null) {
          existQuery = existQuery.eq('stream_id', result.streamId);
        } else {
          existQuery = existQuery.is('stream_id', null);
        }

        const { data: existing, error: existErr } = await existQuery.maybeSingle();
        if (existErr) throw existErr;

        let timetableId: string;

        if (existing) {
          timetableId = existing.id;
        } else {
          // Next version for this class/stream
          let vq = supabase
            .from('timetables')
            .select('version')
            .eq('class_id', result.classId)
            .eq('term', term)
            .eq('academic_year', year)
            .order('version', { ascending: false })
            .limit(1);

          if (result.streamId !== null) {
            vq = vq.eq('stream_id', result.streamId);
          } else {
            vq = vq.is('stream_id', null);
          }

          const { data: versionRows } = await vq;
          const nextVersion = ((versionRows?.[0]?.version) ?? 0) + 1;

          const { data: newRow, error: insertErr } = await supabase
            .from('timetables')
            .insert({
              school_id: schoolId,
              class_id: result.classId,
              stream_id: result.streamId,
              academic_year: year,
              term,
              status: 'staging',
              version: nextVersion,
              generation_id: generationId,
              generated_at: new Date().toISOString(),
            })
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          timetableId = newRow.id;
        }

        // Clear non-locked slots so re-save is safe
        const { error: delSlotsErr } = await supabase
          .from('timetable_slots')
          .delete()
          .eq('timetable_id', timetableId)
          .eq('is_locked', false);
        if (delSlotsErr) throw delSlotsErr;

        // Insert generated slots — strip joined / auto-generated fields
        if (result.slots.length > 0) {
          const slotRows = result.slots.map((s) => ({
            timetable_id: timetableId,
            period_id: s.period_id,
            day_of_week: s.day_of_week,
            subject_id: s.subject_id,
            teacher_id: s.teacher_id,
            special_room_id: s.special_room_id,
            is_locked: false,
            notes: s.notes ?? null,
          }));

          const { error: slotsErr } = await supabase
            .from('timetable_slots')
            .insert(slotRows);
          if (slotsErr) throw slotsErr;
        }

        savedIds.push(timetableId);
      }
    } catch (err) {
      // Rollback: delete ALL staging rows — slots cascade-delete with them
      await supabase
        .from('timetables')
        .delete()
        .eq('school_id', schoolId)
        .eq('generation_id', generationId)
        .eq('status', 'staging');
      throw err; // no silent failures (spec §7)
    }

    // ── Phase 2: promote all staging → draft ───────────────────────────────
    const { error: promoteErr } = await supabase
      .from('timetables')
      .update({ status: 'draft' })
      .eq('school_id', schoolId)
      .eq('generation_id', generationId)
      .eq('status', 'staging');

    if (promoteErr) {
      await supabase
        .from('timetables')
        .delete()
        .eq('school_id', schoolId)
        .eq('generation_id', generationId)
        .eq('status', 'staging');
      throw promoteErr; // no silent failures (spec §7)
    }

    return { savedCount: savedIds.length, timetableIds: savedIds };
  },

  // ============================================================
  // Internal helpers
  // ============================================================

  async _insertAuditLog(
    timetableId: string,
    action: string,
    changes: Record<string, { before: unknown; after: unknown }>
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('timetable_audit_logs').insert({
      timetable_id: timetableId,
      action,
      user_id: user.id,
      changes,
    });
  },
};
