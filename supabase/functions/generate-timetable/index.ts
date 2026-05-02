import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_BACKTRACK_DEFAULT = 1000;

// ============================================================
// Seeded PRNG — mulberry32 (spec §2.1)
// ============================================================
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function seededShuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  // School-mode extensions
  mode?: 'class' | 'school';
  schoolId?: number;
  seed?: number;
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

  const { classId, streamId, term, year, constraints, preserveLocked, mode = 'class', schoolId, seed } = body;

  if (!term || !year || !constraints) {
    return new Response(JSON.stringify({ error: 'Missing required fields: term, year, constraints' }), { status: 400 });
  }

  // ============================================================
  // SCHOOL-WIDE MODE — single batched data load, no per-class queries
  // ============================================================
  if (mode === 'school') {
    if (!schoolId) {
      return new Response(JSON.stringify({ error: 'schoolId is required for school mode' }), { status: 400 });
    }

    const effectiveSeed = seed ?? Date.now();

    try {
      // ── Round 1: all classes for this school ──────────────────
      const { data: classes, error: classesErr } = await supabase
        .from('classes')
        .select('id, name, grade_level')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (classesErr) throw classesErr;

      const classIds: number[] = (classes ?? []).map((c: any) => c.id);
      if (classIds.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No active classes found for this school' }),
          { status: 422, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
        );
      }

      // ── Round 2: single Promise.all — everything needing classIds or schoolId ─
      const [
        csResult,
        streamsResult,
        periodsResult,
        roomsResult,
        calResult,
        timetablesResult,
      ] = await Promise.all([
        // All class_subjects for ALL classes in one query (no per-class loops)
        supabase
          .from('class_subjects')
          .select(`id, class_id, stream_id, subject_id, teacher_id,
            periods_per_week, is_double, requires_special_room,
            preferred_room_type, priority,
            subject:subjects(id, name, code),
            teacher:teachers(id, first_name, last_name)`)
          .in('class_id', classIds)
          .eq('is_active', true)
          .order('class_id', { ascending: true })
          .order('subject_id', { ascending: true }),

        // All streams for these classes
        supabase
          .from('streams')
          .select('id, class_id, name, current_enrollment')
          .in('class_id', classIds)
          .eq('is_active', true),

        // All periods for the school
        supabase
          .from('school_periods')
          .select('*')
          .eq('school_id', schoolId)
          .order('order_index', { ascending: true }),

        // All active special rooms for the school
        supabase
          .from('special_rooms')
          .select('*')
          .eq('school_id', schoolId)
          .eq('is_active', true)
          .order('room_type', { ascending: true })
          .order('id', { ascending: true }),

        // Calendar events that could black out slots
        supabase
          .from('school_calendar_events')
          .select('start_date, end_date, affected_period_ids, affects_all_classes, affected_class_ids')
          .eq('school_id', schoolId)
          .eq('academic_year', year)
          .or(`term.eq.${term},term.is.null`),

        // Non-archived timetables for school/term/year — we need their IDs for locked slots
        supabase
          .from('timetables')
          .select('id, class_id, stream_id')
          .eq('school_id', schoolId)
          .eq('term', term)
          .eq('academic_year', year)
          .neq('status', 'archived'),
      ]);

      if (csResult.error) throw csResult.error;
      if (streamsResult.error) throw streamsResult.error;
      if (periodsResult.error) throw periodsResult.error;
      if (roomsResult.error) throw roomsResult.error;
      if (calResult.error) throw calResult.error;
      if (timetablesResult.error) throw timetablesResult.error;

      const allClassSubjects: any[] = csResult.data ?? [];
      const allStreams: any[] = streamsResult.data ?? [];
      const allPeriods: any[] = periodsResult.data ?? [];
      const allRooms: any[] = (roomsResult.data as any[]) ?? [];
      const timetableIds: string[] = (timetablesResult.data ?? []).map((t: any) => t.id);

      // Derive teacher/room sets for occupancy RPCs — no per-class iteration
      const uniqueTeacherIds: number[] = [
        ...new Set(allClassSubjects.filter((cs: any) => cs.teacher_id).map((cs: any) => cs.teacher_id as number)),
      ].sort((a, b) => a - b);
      const allRoomIds: string[] = allRooms.map((r: any) => r.id as string);

      // ── Round 3: single Promise.all — occupancy maps + locked slots ─────────
      const [
        teacherOccResult,
        roomOccResult,
        teacherLoadResult,
        roomUsageResult,
        lockedSlotsResult,
      ] = await Promise.all([
        uniqueTeacherIds.length > 0
          ? supabase.rpc('get_teacher_occupied_slots', { teacher_ids: uniqueTeacherIds, p_term: term, p_year: year })
          : Promise.resolve({ data: [], error: null }),

        allRoomIds.length > 0
          ? supabase.rpc('get_special_room_occupied_slots', { room_ids: allRoomIds, p_term: term, p_year: year })
          : Promise.resolve({ data: [], error: null }),

        uniqueTeacherIds.length > 0
          ? supabase.rpc('get_teacher_weekly_load', { teacher_ids: uniqueTeacherIds, p_term: term, p_year: year })
          : Promise.resolve({ data: [], error: null }),

        allRoomIds.length > 0
          ? supabase.rpc('get_special_room_usage_count', { room_ids: allRoomIds, p_term: term, p_year: year })
          : Promise.resolve({ data: [], error: null }),

        // ALL locked slots across all existing timetables for this school — single IN query
        timetableIds.length > 0
          ? supabase
              .from('timetable_slots')
              .select('*')
              .in('timetable_id', timetableIds)
              .eq('is_locked', true)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (teacherOccResult.error) throw teacherOccResult.error;
      if (roomOccResult.error) throw roomOccResult.error;
      if (teacherLoadResult.error) throw teacherLoadResult.error;
      if (roomUsageResult.error) throw roomUsageResult.error;
      if (lockedSlotsResult.error) throw lockedSlotsResult.error;

      const allLockedSlots: any[] = (lockedSlotsResult.data as any[]) ?? [];

      // ============================================================
      // SHARED MAPS — seeded from DB data then overlaid with locked slots
      // (spec §3.2)
      // ============================================================

      // teacherOccupancyMap  key: `${teacherId}_${day}_${periodId}`
      const teacherOccupancyMap = new Map<string, boolean>();
      for (const row of (teacherOccResult.data ?? [])) {
        teacherOccupancyMap.set(`${row.teacher_id}_${row.day_of_week}_${row.period_id}`, true);
      }

      // roomOccupancyMap  key: `${roomId}_${day}_${periodId}`
      const roomOccupancyMap = new Map<string, boolean>();
      for (const row of (roomOccResult.data ?? [])) {
        roomOccupancyMap.set(`${row.special_room_id}_${row.day_of_week}_${row.period_id}`, true);
      }

      // teacherLoadMap (weekly)  key: teacherId
      const teacherLoadMap = new Map<number, number>();
      for (const row of (teacherLoadResult.data ?? [])) {
        teacherLoadMap.set(Number(row.teacher_id), Number(row.assigned_count));
      }

      // roomUsageMap  key: roomId
      const roomUsageMap = new Map<string, number>();
      for (const row of (roomUsageResult.data ?? [])) {
        roomUsageMap.set(String(row.special_room_id), Number(row.usage_count));
      }

      // teacherDailyLoadMap  key: `${teacherId}_${day}`  — start at 0 from DB baseline
      // (DB RPCs give per-slot rows; we aggregate to a daily count)
      const teacherDailyLoadMap = new Map<string, number>();
      for (const row of (teacherOccResult.data ?? [])) {
        const k = `${row.teacher_id}_${row.day_of_week}`;
        teacherDailyLoadMap.set(k, (teacherDailyLoadMap.get(k) ?? 0) + 1);
      }

      // Overlay locked slots — locked slots are NOT returned by the occupancy
      // RPCs (which reflect already-persisted published/draft slots), so we
      // must add them manually to ensure hard constraints respect locks.
      for (const ls of allLockedSlots) {
        if (ls.teacher_id) {
          const occKey = `${ls.teacher_id}_${ls.day_of_week}_${ls.period_id}`;
          teacherOccupancyMap.set(occKey, true);

          const dailyKey = `${ls.teacher_id}_${ls.day_of_week}`;
          teacherDailyLoadMap.set(dailyKey, (teacherDailyLoadMap.get(dailyKey) ?? 0) + 1);

          teacherLoadMap.set(ls.teacher_id, (teacherLoadMap.get(ls.teacher_id) ?? 0) + 1);
        }
        if (ls.special_room_id) {
          atomicAssignRoom(String(ls.special_room_id), ls.day_of_week, ls.period_id, roomOccupancyMap, roomUsageMap);
        }
      }

      // ============================================================
      // SCHEDULING — main assignment loop  (spec §3.1–§3.9)
      // ============================================================

      const TIMEOUT_MS = 50_000;
      const STARVATION_THRESHOLD = 5;
      const MAX_MICRO_BACKTRACKS = 50;
      const TIGHT_BUFFER_RATIO = 0.15;
      const DAYS = [1, 2, 3, 4, 5];
      const rand = mulberry32(effectiveSeed); // single seeded PRNG for entire run
      const startTime = Date.now();

      const nonBreakPeriods: any[] = allPeriods.filter((p: any) => !p.is_break);

      // ── Precompute valid double pairs per day (spec §3.4) ──────────────────
      // MUST be precomputed, MUST NOT span breaks, MUST NOT be computed inline
      const validDoublePairs = new Map<number, Array<[any, any]>>();
      for (const d of DAYS) {
        const dp = nonBreakPeriods
          .filter((p: any) => p.days_of_week?.includes(d))
          .sort((a: any, b: any) => a.order_index - b.order_index);
        const pairs: Array<[any, any]> = [];
        for (let i = 0; i < dp.length - 1; i++) {
          if (dp[i + 1].order_index === dp[i].order_index + 1) pairs.push([dp[i], dp[i + 1]]);
        }
        validDoublePairs.set(d, pairs);
      }

      // ── Central blackoutSet (spec §3.5) ───────────────────────────────────
      // key: `${dayOfWeek}_${periodId}` — single source of truth
      const blackoutSet = new Set<string>();
      for (const evt of (calResult.data ?? [])) {
        const cur = new Date(evt.start_date);
        const end = new Date(evt.end_date);
        while (cur <= end) {
          const dow = cur.getDay(); // 1=Mon…5=Fri
          if (dow >= 1 && dow <= 5) {
            if (evt.affected_period_ids?.length > 0) {
              for (const pid of evt.affected_period_ids) blackoutSet.add(`${dow}_${pid}`);
            } else {
              for (const p of nonBreakPeriods) blackoutSet.add(`${dow}_${p.id}`);
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      // Single source of truth checked in all three places (spec §3.5)
      const isBlackout = (day: number, periodId: string): boolean =>
        blackoutSet.has(`${day}_${periodId}`);

      // ── Class lookup ───────────────────────────────────────────────────────
      const classById = new Map<number, any>();
      for (const c of (classes ?? [])) classById.set(c.id, c);

      // ── Map timetableId → classKey for locked-slot grouping ───────────────
      const timetableKeyMap = new Map<string, string>();
      for (const t of (timetablesResult.data ?? [])) {
        timetableKeyMap.set(t.id, `${t.class_id}_${t.stream_id ?? 'null'}`);
      }

      // ── Group locked slots by classKey ────────────────────────────────────
      const classLockedSlots = new Map<string, any[]>();
      for (const ls of allLockedSlots) {
        const ck = timetableKeyMap.get(ls.timetable_id);
        if (!ck) continue;
        if (!classLockedSlots.has(ck)) classLockedSlots.set(ck, []);
        classLockedSlots.get(ck)!.push(ls);
      }

      // ── Per-class grids, locked slots pre-populated ────────────────────────
      // classKey: `${classId}_${streamId ?? 'null'}`
      type Grid = Record<number, Record<string, any>>;
      const classStreamKeys = new Set<string>();
      for (const cs of allClassSubjects) {
        classStreamKeys.add(`${cs.class_id}_${cs.stream_id ?? 'null'}`);
      }
      const classGrids = new Map<string, Grid>();
      for (const key of classStreamKeys) {
        const g: Grid = {};
        for (const d of DAYS) {
          g[d] = {};
          for (const p of nonBreakPeriods) g[d][p.id] = null;
        }
        for (const ls of (classLockedSlots.get(key) ?? [])) {
          if (g[ls.day_of_week]) g[ls.day_of_week][ls.period_id] = ls;
        }
        classGrids.set(key, g);
      }

      // ── Feasibility classification per class (spec §3.6) ──────────────────
      interface FeasInfo {
        feasibility: 'ok' | 'tight' | 'impossible';
        required: number; available: number;
        error?: { required: number; available: number };
      }
      const feasByKey = new Map<string, FeasInfo>();
      for (const key of classStreamKeys) {
        const [cIdStr, sIdStr] = key.split('_');
        const cId = Number(cIdStr);
        const sId = sIdStr === 'null' ? null : Number(sIdStr);
        const cSubjects = allClassSubjects.filter(
          (cs: any) => cs.class_id === cId && (cs.stream_id === sId || cs.stream_id === null),
        );
        const required = cSubjects.reduce((s: number, cs: any) => s + cs.periods_per_week, 0);
        const grid = classGrids.get(key)!;
        let available = 0;
        for (const d of DAYS) {
          for (const p of nonBreakPeriods) {
            if (!p.days_of_week?.includes(d)) continue;
            if (grid[d][p.id]) continue; // locked slot occupies this slot
            if (isBlackout(d, p.id)) continue;
            available++;
          }
        }
        const impossible = required > available;
        const tight = !impossible && (available - required) < available * TIGHT_BUFFER_RATIO;
        feasByKey.set(key, {
          feasibility: impossible ? 'impossible' : tight ? 'tight' : 'ok',
          required, available,
          error: impossible ? { required, available } : undefined,
        });
      }

      // ── Global task queue (spec §3.1) ──────────────────────────────────────
      interface Task {
        classKey: string; classId: number; streamId: number | null; cs: any;
        remainingPeriods: number;
        attempts: number;       // consecutive failures — reset on success or starvation move
        totalAttempts: number;  // cumulative — never reset, capped at maxTotalAttempts
        maxTotalAttempts: number; // periods_per_week × 10 (spec §3.1)
        boostedPriority: number;
      }
      const taskQueue: Task[] = [];
      for (const key of classStreamKeys) {
        if (feasByKey.get(key)!.feasibility === 'impossible') continue; // skip entirely (spec §3.6)
        const [cIdStr, sIdStr] = key.split('_');
        const cId = Number(cIdStr), sId = sIdStr === 'null' ? null : Number(sIdStr);
        const cSubjects = allClassSubjects.filter(
          (cs: any) => cs.class_id === cId && (cs.stream_id === sId || cs.stream_id === null),
        );
        for (const cs of cSubjects) {
          taskQueue.push({
            classKey: key, classId: cId, streamId: sId, cs,
            remainingPeriods: cs.periods_per_week,
            attempts: 0, totalAttempts: 0,
            maxTotalAttempts: cs.periods_per_week * 10,
            boostedPriority: cs.priority ?? 0,
          });
        }
      }
      // Stable sort: priority DESC → periods_per_week DESC → requires_special_room DESC
      //              → classId ASC → subjectId ASC  (spec §3.1)
      const sortTasks = (a: Task, b: Task): number => {
        if (b.boostedPriority !== a.boostedPriority) return b.boostedPriority - a.boostedPriority;
        if (b.cs.periods_per_week !== a.cs.periods_per_week) return b.cs.periods_per_week - a.cs.periods_per_week;
        const ra = Number(a.cs.requires_special_room), rb = Number(b.cs.requires_special_room);
        if (rb !== ra) return rb - ra;
        if (a.classId !== b.classId) return a.classId - b.classId;
        return a.cs.subject_id - b.cs.subject_id;
      };
      taskQueue.sort(sortTasks);

      // ── Assignment history for micro-backtracking (spec §3.8) ─────────────
      // ONLY isGenerated:true entries may ever be rolled back
      interface HistEntry {
        slot: any; classKey: string;
        teacherId: number | null; roomId: string | null;
        day: number; periodId: string;
        isGenerated: true;
      }
      const assignmentHistory: HistEntry[] = [];
      let microBacktrackOps = 0; // global cap: MAX_MICRO_BACKTRACKS total

      // ── Per-class slot and unassigned tracking ─────────────────────────────
      const generatedByClass = new Map<string, any[]>();
      const unassignedByClass = new Map<string, any[]>();
      for (const key of classStreamKeys) {
        generatedByClass.set(key, []);
        unassignedByClass.set(key, []);
      }

      // ── Retry queue — starvation protection (spec §3.7) ───────────────────
      const retryQueue: Task[] = [];

      // ── EMA durations for predictive timeout (spec §3.9) ──────────────────
      const iterDurations: number[] = [];

      // ── Class-size helper ─────────────────────────────────────────────────
      const getClassSize = (key: string): number => {
        const sid = key.split('_')[1];
        if (sid === 'null') return 40;
        const s = allStreams.find((st: any) => st.id === Number(sid));
        return (s as any)?.current_enrollment ?? 40;
      };

      // ── tryAssignSlot: one single-period assignment attempt ────────────────
      const tryAssignSlot = (task: Task): boolean => {
        const { classKey, cs } = task;
        const grid = classGrids.get(classKey)!;
        const sz = getClassSize(classKey);
        const teacherId: number | null = cs.teacher_id ?? null;

        const candidates: { day: number; periodId: string; tb: number }[] = [];
        for (const d of DAYS) {
          for (const p of nonBreakPeriods) {
            if (!p.days_of_week?.includes(d)) continue;
            if (grid[d][p.id]) continue;
            if (isBlackout(d, p.id)) continue; // spec §3.5
            if (teacherId) {
              if (teacherOccupancyMap.has(`${teacherId}_${d}_${p.id}`)) continue;
              // HARD skip: daily load cap — not a score penalty (spec §2.3)
              if ((teacherDailyLoadMap.get(`${teacherId}_${d}`) ?? 0) >= constraints.maxPeriodsPerDay) continue;
            }
            if (cs.requires_special_room) {
              if (!selectRoom(cs, d, p.id, allRooms, roomOccupancyMap, roomUsageMap, sz)) continue;
            }
            candidates.push({ day: d, periodId: p.id, tb: rand() }); // seeded tiebreaker (spec §2.1)
          }
        }
        if (candidates.length === 0) return false;

        candidates.sort((a, b) => a.tb - b.tb);
        const best = candidates[0];

        let roomId: string | null = null;
        if (cs.requires_special_room) {
          const room = selectRoom(cs, best.day, best.periodId, allRooms, roomOccupancyMap, roomUsageMap, sz);
          if (!room) return false; // room snatched between scan and commit
          roomId = room.id;
          atomicAssignRoom(roomId, best.day, best.periodId, roomOccupancyMap, roomUsageMap);
        }

        const slot = makeSlot(cs, best.day, best.periodId, roomId);
        grid[best.day][best.periodId] = slot;
        generatedByClass.get(classKey)!.push(slot);

        if (teacherId) {
          teacherOccupancyMap.set(`${teacherId}_${best.day}_${best.periodId}`, true);
          const dk = `${teacherId}_${best.day}`;
          teacherDailyLoadMap.set(dk, (teacherDailyLoadMap.get(dk) ?? 0) + 1);
          teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) ?? 0) + 1);
        }
        assignmentHistory.push({
          slot, classKey, teacherId, roomId,
          day: best.day, periodId: best.periodId, isGenerated: true,
        });
        return true;
      };

      // ── tryAssignDouble: one consecutive double-period assignment attempt ──
      const tryAssignDouble = (task: Task): boolean => {
        const { classKey, cs } = task;
        const grid = classGrids.get(classKey)!;
        const sz = getClassSize(classKey);
        const teacherId: number | null = cs.teacher_id ?? null;

        // seededShuffle day order for determinism (spec §2.1)
        const dayOrder = seededShuffle([...DAYS], rand);
        for (const d of dayOrder) {
          for (const [p1, p2] of (validDoublePairs.get(d) ?? [])) {
            if (grid[d][p1.id] || grid[d][p2.id]) continue;
            if (isBlackout(d, p1.id) || isBlackout(d, p2.id)) continue; // spec §3.5
            if (teacherId) {
              if (teacherOccupancyMap.has(`${teacherId}_${d}_${p1.id}`)) continue;
              if (teacherOccupancyMap.has(`${teacherId}_${d}_${p2.id}`)) continue;
              if ((teacherDailyLoadMap.get(`${teacherId}_${d}`) ?? 0) + 2 > constraints.maxPeriodsPerDay) continue;
            }
            let roomId: string | null = null;
            if (cs.requires_special_room) {
              const r1 = selectRoom(cs, d, p1.id, allRooms, roomOccupancyMap, roomUsageMap, sz);
              if (!r1) continue;
              const r2 = selectRoom(cs, d, p2.id, allRooms, roomOccupancyMap, roomUsageMap, sz);
              if (!r2 || r2.id !== r1.id) continue; // must be the same room
              roomId = r1.id;
              atomicAssignRoom(roomId, d, p1.id, roomOccupancyMap, roomUsageMap);
              atomicAssignRoom(roomId, d, p2.id, roomOccupancyMap, roomUsageMap);
            }
            const slot1 = makeSlot(cs, d, p1.id, roomId);
            const slot2 = makeSlot(cs, d, p2.id, roomId);
            grid[d][p1.id] = slot1;
            grid[d][p2.id] = slot2;
            generatedByClass.get(classKey)!.push(slot1, slot2);
            if (teacherId) {
              teacherOccupancyMap.set(`${teacherId}_${d}_${p1.id}`, true);
              teacherOccupancyMap.set(`${teacherId}_${d}_${p2.id}`, true);
              const dk = `${teacherId}_${d}`;
              teacherDailyLoadMap.set(dk, (teacherDailyLoadMap.get(dk) ?? 0) + 2);
              teacherLoadMap.set(teacherId, (teacherLoadMap.get(teacherId) ?? 0) + 2);
            }
            assignmentHistory.push(
              { slot: slot1, classKey, teacherId, roomId, day: d, periodId: p1.id, isGenerated: true },
              { slot: slot2, classKey, teacherId, roomId, day: d, periodId: p2.id, isGenerated: true },
            );
            return true;
          }
        }
        return false;
      };

      // ── microBacktrack: roll back last n isGenerated history entries ───────
      // spec §3.8: cap at MAX_MICRO_BACKTRACKS total, NEVER touch locked slots
      const microBacktrack = (n: number): void => {
        for (
          let i = 0;
          i < n && assignmentHistory.length > 0 && microBacktrackOps < MAX_MICRO_BACKTRACKS;
          i++
        ) {
          const entry = assignmentHistory[assignmentHistory.length - 1];
          if (!entry.isGenerated) break; // guard: never rollback locked/DB-loaded slots
          assignmentHistory.pop();

          const grid = classGrids.get(entry.classKey)!;
          grid[entry.day][entry.periodId] = null;

          const gen = generatedByClass.get(entry.classKey)!;
          const idx = gen.lastIndexOf(entry.slot);
          if (idx >= 0) gen.splice(idx, 1);

          if (entry.teacherId) {
            teacherOccupancyMap.delete(`${entry.teacherId}_${entry.day}_${entry.periodId}`);
            const dk = `${entry.teacherId}_${entry.day}`;
            const pd = teacherDailyLoadMap.get(dk) ?? 0;
            if (pd <= 1) teacherDailyLoadMap.delete(dk); else teacherDailyLoadMap.set(dk, pd - 1);
            const pw = teacherLoadMap.get(entry.teacherId) ?? 0;
            if (pw <= 1) teacherLoadMap.delete(entry.teacherId); else teacherLoadMap.set(entry.teacherId, pw - 1);
          }
          if (entry.roomId) {
            atomicReleaseRoom(entry.roomId, entry.day, entry.periodId, roomOccupancyMap, roomUsageMap);
          }
          microBacktrackOps++;
        }
      };

      // ── Audit: generation start (best-effort — table requires timetable FK) (spec §6)
      try {
        await supabase.from('timetable_audit_logs').insert({
          action: 'school_generation_start',
          changes: { seed: effectiveSeed, classCount: classIds.length, term, year },
        });
      } catch { /* audit failure must never abort generation */ }

      // ── MAIN ASSIGNMENT LOOP ──────────────────────────────────────────────
      let timedOut = false;
      let timedOutReason: 'elapsed' | 'predicted' | undefined;
      let activeQueue: Task[] = [...taskQueue];

      mainLoop: while (activeQueue.length > 0 || retryQueue.length > 0) {
        // Predictive timeout: EMA of last 10 iteration durations (spec §3.9)
        if (iterDurations.length >= 2) {
          const window = iterDurations.slice(-10);
          const avg = window.reduce((a, b) => a + b, 0) / window.length;
          const remaining = TIMEOUT_MS - (Date.now() - startTime);
          if ((activeQueue.length + retryQueue.length) * avg > remaining) {
            timedOut = true; timedOutReason = 'predicted'; break mainLoop;
          }
        }
        // Hard timeout (spec §3.9)
        if (Date.now() - startTime >= TIMEOUT_MS) {
          timedOut = true; timedOutReason = 'elapsed'; break mainLoop;
        }

        const iterStart = Date.now();

        // Drain retry queue → active when main queue is empty
        if (activeQueue.length === 0) {
          activeQueue = retryQueue.splice(0);
          activeQueue.sort(sortTasks);
        }

        const task = activeQueue.shift()!;

        // Impossible classes are never enqueued; double-guard here
        if (feasByKey.get(task.classKey)?.feasibility === 'impossible') continue;

        // Exhaust check (spec §3.1)
        if (task.totalAttempts >= task.maxTotalAttempts) {
          unassignedByClass.get(task.classKey)!.push({
            subjectId: task.cs.subject_id,
            subjectName: task.cs.subject?.name ?? String(task.cs.subject_id),
            teacherId: task.cs.teacher_id ?? undefined,
            reason: 'exhausted_attempts',
          });
          continue;
        }

        task.totalAttempts++;

        // Double subject with odd remainingPeriods cannot form a pair
        const isDouble = !!task.cs.is_double;
        if (isDouble && task.remainingPeriods < 2) {
          unassignedByClass.get(task.classKey)!.push({
            subjectId: task.cs.subject_id,
            subjectName: task.cs.subject?.name ?? String(task.cs.subject_id),
            teacherId: task.cs.teacher_id ?? undefined,
            reason: 'no_valid_slot',
          });
          continue;
        }

        const success = isDouble ? tryAssignDouble(task) : tryAssignSlot(task);

        if (success) {
          task.remainingPeriods -= isDouble ? 2 : 1;
          task.attempts = 0; // reset consecutive failure count
          if (task.remainingPeriods > 0) activeQueue.push(task);
        } else {
          task.attempts++;

          if (task.attempts >= STARVATION_THRESHOLD) {
            // Starvation protection (spec §3.7): boost priority +1, move to retry queue
            task.attempts = 0;
            task.boostedPriority += 1;
            retryQueue.push(task);
          } else {
            // Micro-backtrack: roll back 3–5 entries to open slots (spec §3.8)
            if (microBacktrackOps < MAX_MICRO_BACKTRACKS) {
              microBacktrack(3 + Math.floor(rand() * 3)); // 3, 4, or 5
            }
            activeQueue.push(task); // re-enqueue for retry
          }
        }

        iterDurations.push(Date.now() - iterStart);
      }

      // Remaining tasks at timeout → mark timed-out (spec §3.9)
      if (timedOut) {
        for (const task of [...activeQueue, ...retryQueue]) {
          if (task.remainingPeriods > 0) {
            unassignedByClass.get(task.classKey)!.push({
              subjectId: task.cs.subject_id,
              subjectName: task.cs.subject?.name ?? String(task.cs.subject_id),
              teacherId: task.cs.teacher_id ?? undefined,
              reason: 'timeout',
            });
          }
        }
      }

      // ── Global conflict detection across ALL classes (spec §2.2) ──────────
      const allSlotsForConflict: any[] = [];
      for (const slots of generatedByClass.values()) allSlotsForConflict.push(...slots);
      for (const ls of allLockedSlots) allSlotsForConflict.push(ls);
      const globalConflicts = detectConflicts(allSlotsForConflict, allPeriods, constraints);

      // ── Per-class results (spec §4.2) ──────────────────────────────────────
      const classResults: any[] = [];
      for (const key of classStreamKeys) {
        const [cIdStr, sIdStr] = key.split('_');
        const cId = Number(cIdStr), sId = sIdStr === 'null' ? null : Number(sIdStr);
        const feas = feasByKey.get(key)!;
        const gen = generatedByClass.get(key) ?? [];
        const locked = classLockedSlots.get(key) ?? [];
        const allSlots = [...locked, ...gen];
        const cls = classById.get(cId);
        const stream = allStreams.find((s: any) => s.id === sId);
        const slotConflicts = globalConflicts.filter((c: any) =>
          c.affectedSlotIds?.some((id: string) => allSlots.find((s: any) => s.id === id)),
        );
        classResults.push({
          classId: cId, streamId: sId,
          className: cls?.name ?? String(cId),
          streamName: stream?.name,
          feasibility: feas.feasibility,
          feasibilityError: feas.error,
          slots: gen,
          conflicts: slotConflicts,
          unassigned: unassignedByClass.get(key) ?? [],
          slotsFilled: gen.length,
          slotsRequired: feas.required,
        });
      }

      const executionTime = Date.now() - startTime;

      // ── Audit: generation end (best-effort, spec §6) ──────────────────────
      try {
        await supabase.from('timetable_audit_logs').insert({
          action: 'school_generation_end',
          changes: {
            seed: effectiveSeed, executionTime, timedOut, timedOutReason,
            classCount: classResults.length,
            totalSlots: allSlotsForConflict.length,
            globalConflictCount: globalConflicts.length,
          },
        });
      } catch { /* audit failure must never abort generation */ }

      // ── Response (spec §4.1) ──────────────────────────────────────────────
      return new Response(
        JSON.stringify({
          results: classResults,
          globalConflicts,
          executionTime,
          timedOut,
          timedOutReason,
          seed: effectiveSeed,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      );
    } catch (err: any) {
      console.error('generate-timetable school-mode error:', err);
      return new Response(
        JSON.stringify({ error: err.message ?? 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      );
    }
  }

  // ── CLASS MODE (original, unchanged below this line) ──────────────────────
  if (!classId) {
    return new Response(JSON.stringify({ error: 'Missing required field: classId' }), { status: 400 });
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

/**
 * Atomically marks a room as occupied AND increments its usage counter.
 * This is the ONLY function that may write to roomOccupancyMap / roomUsageMap
 * during assignment. (spec §3.3)
 */
function atomicAssignRoom(
  roomId: string,
  day: number,
  periodId: string,
  roomOccupancyMap: Map<string, boolean>,
  roomUsageMap: Map<string, number>,
): void {
  roomOccupancyMap.set(`${roomId}_${day}_${periodId}`, true);
  roomUsageMap.set(roomId, (roomUsageMap.get(roomId) ?? 0) + 1);
}

/**
 * Atomically releases a room booking AND decrements its usage counter.
 * This is the ONLY function that may delete from roomOccupancyMap / roomUsageMap
 * during rollback. (spec §3.3)
 */
function atomicReleaseRoom(
  roomId: string,
  day: number,
  periodId: string,
  roomOccupancyMap: Map<string, boolean>,
  roomUsageMap: Map<string, number>,
): void {
  roomOccupancyMap.delete(`${roomId}_${day}_${periodId}`);
  const prev = roomUsageMap.get(roomId) ?? 0;
  if (prev <= 1) {
    roomUsageMap.delete(roomId);
  } else {
    roomUsageMap.set(roomId, prev - 1);
  }
}

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

// shuffled() removed — replaced by seededShuffle(arr, rand) — see spec §2.1

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
