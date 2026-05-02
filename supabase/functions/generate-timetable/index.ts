import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BACKTRACK_DEFAULT = 1000;

interface SchedulingConstraints {
  avoidBackToBack: boolean;
  evenDistribution: boolean;
  maxPeriodsPerDay: number;
  maxPeriodsPerWeek: number | null;
  regenerateScope: 'full' | 'day' | 'subject';
  scopeTarget?: number | string;
  maxBacktrackSteps?: number;
  constraintWeights?: {
    idle_gap?: number;
    teacher_overload?: number;
    subject_spread?: number;
  };
}

interface GenerateRequest {
  classId: number;
  streamId: number | null;
  term: number;
  year: number;
  constraints: SchedulingConstraints;
  preserveLocked: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { classId, streamId, term, year, constraints, preserveLocked } = body;

  if (!classId || !term || !year || !constraints) {
    return new Response(JSON.stringify({ error: 'Missing required fields: classId, term, year, constraints' }), { status: 400 });
  }

  const weights = {
    idle_gap: constraints.constraintWeights?.idle_gap ?? 15,
    teacher_overload: constraints.constraintWeights?.teacher_overload ?? 8,
    subject_spread: constraints.constraintWeights?.subject_spread ?? 10,
    subject_spread_backtoback: 5,
  };
  const MAX_BACKTRACK = constraints.maxBacktrackSteps ?? MAX_BACKTRACK_DEFAULT;

  try {
    // ============================================================
    // PRE-PROCESSING (all DB calls batched via Promise.all)
    // ============================================================

    // 1. Fetch class_subjects with joins + stream.current_enrollment
    const csQuery = supabase
      .from('class_subjects')
      .select(`
        id, class_id, stream_id, subject_id, teacher_id,
        periods_per_week, is_double, requires_special_room,
        preferred_room_type, priority,
        subject:subjects(id, name, code),
        teacher:teachers(id, first_name, last_name)
      `)
      .eq('class_id', classId)
      .eq('is_active', true);

    const streamQuery = streamId
      ? supabase.from('streams').select('id, current_enrollment').eq('id', streamId).single()
      : Promise.resolve({ data: null, error: null });

    // 2. Fetch school_id from the class
    const classQuery = supabase
      .from('classes')
      .select('id, school_id')
      .eq('id', classId)
      .single();

    const [csResult, streamResult, classResult] = await Promise.all([csQuery, streamQuery, classQuery]);

    if (csResult.error) throw csResult.error;
    if (classResult.error) throw classResult.error;

    const schoolId = classResult.data!.school_id;
    const classSize: number = (streamResult.data as any)?.current_enrollment ?? 40;

    // Filter class_subjects by stream
    let classSubjects: any[] = (csResult.data || []);
    if (streamId) {
      classSubjects = classSubjects.filter((cs: any) => cs.stream_id === streamId || cs.stream_id === null);
    }

    const uniqueTeacherIds: number[] = [...new Set(
      classSubjects.filter((cs: any) => cs.teacher_id).map((cs: any) => cs.teacher_id)
    )];

    // 3. Fetch school_periods (non-break)
    const periodsQuery = supabase
      .from('school_periods')
      .select('*')
      .eq('school_id', schoolId)
      .order('order_index', { ascending: true });

    // 4. Fetch needed special rooms
    const neededRoomTypes = [...new Set(
      classSubjects.filter((cs: any) => cs.requires_special_room && cs.preferred_room_type).map((cs: any) => cs.preferred_room_type)
    )];
    const specialRoomsQuery = neededRoomTypes.length > 0
      ? supabase.from('special_rooms').select('*').eq('school_id', schoolId).eq('is_active', true).in('room_type', neededRoomTypes)
      : Promise.resolve({ data: [], error: null });

    // 5. Existing timetable slots (for preserve locked)
    const existingTimetableQuery = supabase
      .from('timetables')
      .select('id, updated_at')
      .eq('class_id', classId)
      .eq('term', term)
      .eq('academic_year', year)
      .neq('status', 'archived')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Calendar events (blackout)
    const calendarQuery = supabase
      .from('school_calendar_events')
      .select('start_date, end_date, affected_period_ids')
      .eq('school_id', schoolId)
      .eq('academic_year', year)
      .or(`term.eq.${term},term.is.null`);

    const [periodsResult, specialRoomsResult, existingTimetableResult, calendarResult] =
      await Promise.all([periodsQuery, specialRoomsQuery, existingTimetableQuery, calendarQuery]);

    if (periodsResult.error) throw periodsResult.error;
    if (specialRoomsResult.error) throw specialRoomsResult.error;
    if (calendarResult.error) throw calendarResult.error;

    const allPeriods: any[] = periodsResult.data || [];
    const nonBreakPeriods = allPeriods.filter((p: any) => !p.is_break);
    const specialRooms: any[] = (specialRoomsResult.data as any[]) || [];
    const existingTimetable: any = existingTimetableResult.data;

    // Batch remaining DB helpers
    const teacherOccupiedQuery = uniqueTeacherIds.length > 0
      ? supabase.rpc('get_teacher_occupied_slots', { teacher_ids: uniqueTeacherIds, p_term: term, p_year: year })
      : Promise.resolve({ data: [], error: null });

    const roomIds: string[] = specialRooms.map((r: any) => r.id);
    const roomOccupiedQuery = roomIds.length > 0
      ? supabase.rpc('get_special_room_occupied_slots', { room_ids: roomIds, p_term: term, p_year: year })
      : Promise.resolve({ data: [], error: null });

    const teacherLoadQuery = uniqueTeacherIds.length > 0
      ? supabase.rpc('get_teacher_weekly_load', { teacher_ids: uniqueTeacherIds, p_term: term, p_year: year })
      : Promise.resolve({ data: [], error: null });

    const roomUsageQuery = roomIds.length > 0
      ? supabase.rpc('get_special_room_usage_count', { room_ids: roomIds, p_term: term, p_year: year })
      : Promise.resolve({ data: [], error: null });

    let existingSlotsQuery: Promise<{ data: any[] | null; error: any }> = Promise.resolve({ data: [], error: null });
    if (existingTimetable && preserveLocked) {
      existingSlotsQuery = supabase
        .from('timetable_slots')
        .select('*')
        .eq('timetable_id', existingTimetable.id)
        .eq('is_locked', true) as any;
    }

    const [teacherOccResult, roomOccResult, teacherLoadResult, roomUsageResult, existingSlotsResult] =
      await Promise.all([teacherOccupiedQuery, roomOccupiedQuery, teacherLoadQuery, roomUsageQuery, existingSlotsQuery]);

    // Build in-memory maps (cached for the lifetime of this invocation)
    const teacherOccupancyMap = new Map<string, boolean>();
    for (const row of (teacherOccResult.data || [])) {
      teacherOccupancyMap.set(`${row.teacher_id}_${row.day_of_week}_${row.period_id}`, true);
    }

    const roomOccupancyMap = new Map<string, boolean>();
    for (const row of (roomOccResult.data || [])) {
      roomOccupancyMap.set(`${row.special_room_id}_${row.day_of_week}_${row.period_id}`, true);
    }

    const teacherLoadMap = new Map<number, number>();
    for (const row of (teacherLoadResult.data || [])) {
      teacherLoadMap.set(row.teacher_id, Number(row.assigned_count));
    }

    const roomUsageMap = new Map<string, number>();
    for (const row of (roomUsageResult.data || [])) {
      roomUsageMap.set(row.special_room_id, Number(row.usage_count));
    }

    // Build blackout set (date string + optional period ids)
    const blackoutByDate = new Map<string, Set<string> | null>(); // date → null=all, Set=specific periods
    const calEvents = calendarResult.data || [];
    for (const evt of calEvents) {
      const start = new Date(evt.start_date);
      const end = new Date(evt.end_date);
      const cursor = new Date(start);
      while (cursor <= end) {
        const ds = cursor.toISOString().split('T')[0];
        if (evt.affected_period_ids && evt.affected_period_ids.length > 0) {
          if (!blackoutByDate.has(ds)) blackoutByDate.set(ds, new Set());
          for (const pid of evt.affected_period_ids) {
            blackoutByDate.get(ds)!.add(pid);
          }
        } else {
          blackoutByDate.set(ds, null); // whole day
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Build grid of locked slots
    // WeeklyGrid: day → periodId → slot | null
    const grid: Record<number, Record<string, any>> = {};
    for (let d = 1; d <= 5; d++) {
      grid[d] = {};
      for (const p of nonBreakPeriods) {
        grid[d][p.id] = null;
      }
    }

    const lockedSlots: any[] = existingSlotsResult.data || [];
    for (const ls of lockedSlots) {
      if (grid[ls.day_of_week]) {
        grid[ls.day_of_week][ls.period_id] = ls;
        // Mark teacher occupied for locked slots
        if (ls.teacher_id) {
          teacherOccupancyMap.set(`${ls.teacher_id}_${ls.day_of_week}_${ls.period_id}`, true);
        }
        if (ls.special_room_id) {
          roomOccupancyMap.set(`${ls.special_room_id}_${ls.day_of_week}_${ls.period_id}`, true);
        }
      }
    }

    // Apply regenerateScope
    const { regenerateScope, scopeTarget } = constraints;
    if (regenerateScope === 'day' && scopeTarget) {
      // Clear only the target day's non-locked slots
      const targetDay = Number(scopeTarget);
      for (const pid of Object.keys(grid[targetDay] || {})) {
        if (!lockedSlots.find((ls: any) => ls.day_of_week === targetDay && ls.period_id === pid)) {
          grid[targetDay][pid] = null;
        }
      }
    } else if (regenerateScope === 'subject' && scopeTarget) {
      // Clear slots for target subject only
      for (let d = 1; d <= 5; d++) {
        for (const pid of Object.keys(grid[d])) {
          const slot = grid[d][pid];
          if (slot && slot.subject_id === Number(scopeTarget) && !slot.is_locked) {
            grid[d][pid] = null;
          }
        }
      }
    }

    // ============================================================
    // PRE-GENERATION FEASIBILITY CHECK
    // ============================================================

    const DAYS = [1, 2, 3, 4, 5];
    let availableSlots = 0;
    for (const d of DAYS) {
      for (const p of nonBreakPeriods) {
        const dateStr = `2026-01-${String(d).padStart(2, '0')}`; // placeholder — we just count
        // Count if not blackout (simplified: check if any period-granular blackout exists is complex without real dates)
        // For feasibility we use total non-break slots
        availableSlots++;
      }
    }
    // Subtract locked slots count (already placed)
    availableSlots -= lockedSlots.length;

    const requiredSlots = classSubjects.reduce((sum: number, cs: any) => sum + cs.periods_per_week, 0);

    if (requiredSlots > availableSlots) {
      return new Response(
        JSON.stringify({
          error: 'INFEASIBLE',
          message: `Insufficient slots: ${requiredSlots} periods needed but only ${availableSlots} available. Remove subjects or reduce periods_per_week.`,
          feasibilityError: { required: requiredSlots, available: availableSlots },
          slots: [],
          conflicts: [],
          unassigned: [],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // ============================================================
    // ASSIGNMENT LOOP
    // ============================================================

    // Sort: priority DESC, periods_per_week DESC, requires_special_room DESC
    classSubjects.sort((a: any, b: any) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.periods_per_week !== a.periods_per_week) return b.periods_per_week - a.periods_per_week;
      return Number(b.requires_special_room) - Number(a.requires_special_room);
    });

    const assignedCount = new Map<number, number>(); // subject_id → count
    const assignedSlots: any[] = [...lockedSlots];
    const unassigned: any[] = [];
    let backtrackSteps = 0;

    const isBlackout = (day: number, periodId: string): boolean => {
      // We don't have real calendar dates in the loop, so we check by period across all blackout dates
      // In production, actual calendar dates would be computed per week
      // For now we skip blackout during assignment (blackout applies when viewing)
      return false;
    };

    for (const cs of classSubjects) {
      const subjectId = cs.subject_id;
      const teacherId = cs.teacher_id;
      const needed = cs.periods_per_week;

      assignedCount.set(subjectId, assignedCount.get(subjectId) ?? 0);

      if ((assignedCount.get(subjectId) ?? 0) >= needed) continue;

      if (cs.is_double) {
        // Find two consecutive non-break periods on the same day
        let placed = false;
        for (const day of shuffled(DAYS)) {
          const dayPeriods = nonBreakPeriods
            .filter((p: any) => p.days_of_week.includes(day))
            .sort((a: any, b: any) => a.order_index - b.order_index);

          for (let i = 0; i < dayPeriods.length - 1; i++) {
            const p1 = dayPeriods[i];
            const p2 = dayPeriods[i + 1];
            if (p2.order_index !== p1.order_index + 1) continue;
            if (grid[day][p1.id] || grid[day][p2.id]) continue;
            if (isBlackout(day, p1.id) || isBlackout(day, p2.id)) continue;
            if (teacherId) {
              if (teacherOccupancyMap.has(`${teacherId}_${day}_${p1.id}`)) continue;
              if (teacherOccupancyMap.has(`${teacherId}_${day}_${p2.id}`)) continue;
            }
            if (cs.requires_special_room) {
              const room = selectRoom(cs, day, p1.id, specialRooms, roomOccupancyMap, roomUsageMap, classSize);
              if (!room) continue;
              const room2 = selectRoom(cs, day, p2.id, specialRooms, roomOccupancyMap, roomUsageMap, classSize);
              if (!room2 || room2.id !== room.id) continue;
              const slot1 = makeSlot(cs, day, p1.id, room.id);
              const slot2 = makeSlot(cs, day, p2.id, room.id);
              grid[day][p1.id] = slot1;
              grid[day][p2.id] = slot2;
              assignedSlots.push(slot1, slot2);
              if (teacherId) {
                teacherOccupancyMap.set(`${teacherId}_${day}_${p1.id}`, true);
                teacherOccupancyMap.set(`${teacherId}_${day}_${p2.id}`, true);
              }
              roomOccupancyMap.set(`${room.id}_${day}_${p1.id}`, true);
              roomOccupancyMap.set(`${room.id}_${day}_${p2.id}`, true);
              roomUsageMap.set(room.id, (roomUsageMap.get(room.id) ?? 0) + 2);
            } else {
              const slot1 = makeSlot(cs, day, p1.id, null);
              const slot2 = makeSlot(cs, day, p2.id, null);
              grid[day][p1.id] = slot1;
              grid[day][p2.id] = slot2;
              assignedSlots.push(slot1, slot2);
              if (teacherId) {
                teacherOccupancyMap.set(`${teacherId}_${day}_${p1.id}`, true);
                teacherOccupancyMap.set(`${teacherId}_${day}_${p2.id}`, true);
              }
            }
            assignedCount.set(subjectId, (assignedCount.get(subjectId) ?? 0) + 2);
            placed = true;
            break;
          }
          if (placed) break;
        }
        if (!placed) {
          unassigned.push({ ...cs, reason: 'no_valid_slot' });
        }
        continue;
      }

      // Non-double subject: assign one slot at a time
      let slotsToAssign = needed - (assignedCount.get(subjectId) ?? 0);
      let localBacktrack = 0;

      while (slotsToAssign > 0) {
        // Collect all candidate (day, period) pairs
        const candidates: { day: number; periodId: string; score: number }[] = [];

        for (const day of DAYS) {
          for (const p of nonBreakPeriods) {
            if (!p.days_of_week.includes(day)) continue;
            if (grid[day][p.id]) continue; // occupied
            if (isBlackout(day, p.id)) continue;
            if (teacherId && teacherOccupancyMap.has(`${teacherId}_${day}_${p.id}`)) continue;

            if (cs.requires_special_room) {
              const room = selectRoom(cs, day, p.id, specialRooms, roomOccupancyMap, roomUsageMap, classSize);
              if (!room) continue;
            }

            // Score
            let score = 0;

            // Subject spread: same subject already today
            const sameDayCount = assignedSlots.filter(
              (s: any) => s.subject_id === subjectId && s.day_of_week === day
            ).length;
            if (sameDayCount > 0) score += weights.subject_spread;

            // Back-to-back same subject
            const sortedDayPeriods = nonBreakPeriods
              .filter((pp: any) => pp.days_of_week.includes(day))
              .sort((a: any, b: any) => a.order_index - b.order_index);
            const pIdx = sortedDayPeriods.findIndex((pp: any) => pp.id === p.id);
            if (pIdx > 0) {
              const prevP = sortedDayPeriods[pIdx - 1];
              const prevSlot = grid[day][prevP.id];
              if (prevSlot?.subject_id === subjectId) score += weights.subject_spread_backtoback;
            }

            // Teacher overload per day
            if (teacherId) {
              const teacherDayCount = assignedSlots.filter(
                (s: any) => s.teacher_id === teacherId && s.day_of_week === day
              ).length;
              if (teacherDayCount >= constraints.maxPeriodsPerDay) score += weights.teacher_overload;

              // Weekly overload
              if (constraints.maxPeriodsPerWeek) {
                const teacherWeekCount = (teacherLoadMap.get(teacherId) ?? 0) +
                  assignedSlots.filter((s: any) => s.teacher_id === teacherId).length;
                if (teacherWeekCount >= constraints.maxPeriodsPerWeek) score += weights.teacher_overload;
              }

              // Idle gap penalty
              const teacherDaySlots = assignedSlots
                .filter((s: any) => s.teacher_id === teacherId && s.day_of_week === day)
                .map((s: any) => sortedDayPeriods.findIndex((pp: any) => pp.id === s.period_id))
                .filter((idx: number) => idx >= 0)
                .sort((a: number, b: number) => a - b);

              if (teacherDaySlots.length > 0) {
                const minIdx = Math.min(...teacherDaySlots, pIdx);
                const maxIdx = Math.max(...teacherDaySlots, pIdx);
                const gap = (maxIdx - minIdx + 1) - (teacherDaySlots.length + 1);
                if (gap > 2) score += gap * weights.idle_gap;
              }
            }

            candidates.push({ day, periodId: p.id, score });
          }
        }

        if (candidates.length === 0) {
          localBacktrack++;
          backtrackSteps++;
          if (backtrackSteps > MAX_BACKTRACK || localBacktrack > 10) {
            unassigned.push({ ...cs, reason: 'backtrack_limit' });
            slotsToAssign = 0;
            break;
          }
          // Remove last assigned slot for this subject and try again
          const lastIdx = assignedSlots.findLastIndex((s: any) => s.subject_id === subjectId && !s.is_locked);
          if (lastIdx >= 0) {
            const removed = assignedSlots.splice(lastIdx, 1)[0];
            grid[removed.day_of_week][removed.period_id] = null;
            if (teacherId) teacherOccupancyMap.delete(`${teacherId}_${removed.day_of_week}_${removed.period_id}`);
            if (removed.special_room_id) roomOccupancyMap.delete(`${removed.special_room_id}_${removed.day_of_week}_${removed.period_id}`);
            assignedCount.set(subjectId, (assignedCount.get(subjectId) ?? 1) - 1);
            slotsToAssign++;
          } else {
            unassigned.push({ ...cs, reason: 'no_valid_slot' });
            slotsToAssign = 0;
          }
          continue;
        }

        // Pick best candidate
        candidates.sort((a, b) => a.score - b.score);
        const best = candidates[0];

        let roomId: string | null = null;
        if (cs.requires_special_room) {
          const room = selectRoom(cs, best.day, best.periodId, specialRooms, roomOccupancyMap, roomUsageMap, classSize);
          if (!room) {
            unassigned.push({ ...cs, reason: 'no_room_capacity' });
            slotsToAssign = 0;
            break;
          }
          roomId = room.id;
          roomOccupancyMap.set(`${roomId}_${best.day}_${best.periodId}`, true);
          roomUsageMap.set(roomId, (roomUsageMap.get(roomId) ?? 0) + 1);
        }

        const newSlot = makeSlot(cs, best.day, best.periodId, roomId);
        grid[best.day][best.periodId] = newSlot;
        assignedSlots.push(newSlot);
        if (teacherId) {
          teacherOccupancyMap.set(`${teacherId}_${best.day}_${best.periodId}`, true);
        }
        assignedCount.set(subjectId, (assignedCount.get(subjectId) ?? 0) + 1);
        slotsToAssign--;
      }
    }

    // ============================================================
    // POST-PROCESSING: detect conflicts
    // ============================================================

    const conflicts = detectConflicts(assignedSlots, allPeriods, constraints);

    return new Response(
      JSON.stringify({
        slots: assignedSlots,
        conflicts,
        unassigned,
        feasibilityError: undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err: any) {
    console.error('generate-timetable error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});

// ============================================================
// Helpers
// ============================================================

function makeSlot(cs: any, day: number, periodId: string, roomId: string | null): any {
  return {
    id: crypto.randomUUID(),
    timetable_id: null, // will be set on save
    period_id: periodId,
    day_of_week: day,
    subject_id: cs.subject_id,
    teacher_id: cs.teacher_id,
    special_room_id: roomId,
    is_locked: false,
    notes: null,
    subject: cs.subject,
    teacher: cs.teacher,
  };
}

function selectRoom(
  cs: any,
  day: number,
  periodId: string,
  specialRooms: any[],
  roomOccupancyMap: Map<string, boolean>,
  roomUsageMap: Map<string, number>,
  classSize: number
): any | null {
  const candidates = specialRooms.filter((r: any) =>
    r.room_type === cs.preferred_room_type &&
    !roomOccupancyMap.has(`${r.id}_${day}_${periodId}`) &&
    r.capacity >= classSize
  );
  if (candidates.length === 0) return null;
  // Least-used first
  candidates.sort((a: any, b: any) => (roomUsageMap.get(a.id) ?? 0) - (roomUsageMap.get(b.id) ?? 0));
  return candidates[0];
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function detectConflicts(slots: any[], allPeriods: any[], constraints: any): any[] {
  const conflicts: any[] = [];
  const periodMap = new Map(allPeriods.map((p: any) => [p.id, p]));
  const sortedPeriods = [...allPeriods].sort((a: any, b: any) => a.order_index - b.order_index);

  // Hard: teacher overlap
  const teacherDayPeriod = new Map<string, any[]>();
  for (const s of slots) {
    if (!s.teacher_id) continue;
    const key = `${s.teacher_id}_${s.day_of_week}_${s.period_id}`;
    if (!teacherDayPeriod.has(key)) teacherDayPeriod.set(key, []);
    teacherDayPeriod.get(key)!.push(s);
  }
  for (const [key, group] of teacherDayPeriod.entries()) {
    if (group.length > 1) {
      conflicts.push({
        type: 'teacher_overlap',
        severity: 'hard',
        day: group[0].day_of_week,
        periodId: group[0].period_id,
        description: `Teacher assigned to multiple classes at the same time`,
        affectedSlotIds: group.map((s: any) => s.id),
      });
    }
  }

  // Hard: special room overlap
  const roomDayPeriod = new Map<string, any[]>();
  for (const s of slots) {
    if (!s.special_room_id) continue;
    const key = `${s.special_room_id}_${s.day_of_week}_${s.period_id}`;
    if (!roomDayPeriod.has(key)) roomDayPeriod.set(key, []);
    roomDayPeriod.get(key)!.push(s);
  }
  for (const [, group] of roomDayPeriod.entries()) {
    if (group.length > 1) {
      conflicts.push({
        type: 'special_room_overlap',
        severity: 'hard',
        day: group[0].day_of_week,
        periodId: group[0].period_id,
        description: `Special room double-booked`,
        affectedSlotIds: group.map((s: any) => s.id),
      });
    }
  }

  // Soft: subject spread
  const subjectDays = new Map<number, Set<number>>();
  for (const s of slots) {
    if (!s.subject_id) continue;
    if (!subjectDays.has(s.subject_id)) subjectDays.set(s.subject_id, new Set());
    subjectDays.get(s.subject_id)!.add(s.day_of_week);
  }

  // Soft: teacher overload per day
  if (constraints.avoidBackToBack || constraints.maxPeriodsPerDay) {
    const teacherDayCounts = new Map<string, number>();
    for (const s of slots) {
      if (!s.teacher_id) continue;
      const key = `${s.teacher_id}_${s.day_of_week}`;
      teacherDayCounts.set(key, (teacherDayCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of teacherDayCounts.entries()) {
      if (count > (constraints.maxPeriodsPerDay ?? 6)) {
        const [teacherId, day] = key.split('_');
        conflicts.push({
          type: 'teacher_overload',
          severity: 'soft',
          day: Number(day),
          periodId: '',
          description: `Teacher has ${count} periods on day ${day} (max ${constraints.maxPeriodsPerDay ?? 6})`,
          affectedSlotIds: slots.filter((s: any) => s.teacher_id === Number(teacherId) && s.day_of_week === Number(day)).map((s: any) => s.id),
        });
      }
    }
  }

  return conflicts;
}
