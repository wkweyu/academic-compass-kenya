-- Timetable Module Schema
-- Migration: 20260501000000_timetable_schema.sql

-- ============================================================
-- 1. ALTER class_subjects — add timetable-specific columns
-- ============================================================

ALTER TABLE public.class_subjects
  ADD COLUMN IF NOT EXISTS stream_id BIGINT REFERENCES public.streams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_double BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_special_room BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_room_type VARCHAR(20) CHECK (preferred_room_type IN ('lab','computer','hall','library','other')),
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

-- Replace old unique constraint (class_id, subject_id) with stream-aware one
ALTER TABLE public.class_subjects
  DROP CONSTRAINT IF EXISTS class_subjects_class_id_subject_id_key;

ALTER TABLE public.class_subjects
  ADD CONSTRAINT class_subjects_class_stream_subject_key
  UNIQUE (class_id, stream_id, subject_id);

-- ============================================================
-- 2. school_periods — atomic time slots (no is_double here;
--    double-lesson logic lives in class_subjects.is_double only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  order_index INT NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  days_of_week INT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. special_rooms — labs, halls, shared facilities
-- ============================================================

CREATE TABLE IF NOT EXISTS public.special_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  capacity INT NOT NULL DEFAULT 40,
  room_type VARCHAR(20) NOT NULL CHECK (room_type IN ('lab','computer','hall','library','other')),
  is_shared BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. school_calendar_events — blackout periods / holidays
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('holiday','exam_period','school_event','closure')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  affects_all_classes BOOLEAN NOT NULL DEFAULT true,
  affected_class_ids BIGINT[],
  affected_period_ids UUID[],   -- NULL = all periods on date range; set = only these periods blocked
  academic_year INT NOT NULL,
  term INT CHECK (term IN (1,2,3)),  -- NULL = all terms
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. timetables — versioned, term-scoped timetable headers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  stream_id BIGINT REFERENCES public.streams(id) ON DELETE SET NULL,
  academic_year INT NOT NULL,
  term INT NOT NULL CHECK (term IN (1,2,3)),
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  version INT NOT NULL DEFAULT 1,
  parent_version_id UUID REFERENCES public.timetables(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, stream_id, academic_year, term, version)
);

-- ============================================================
-- 6. timetable_slots — individual period assignments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.school_periods(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  subject_id BIGINT REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE SET NULL,
  special_room_id UUID REFERENCES public.special_rooms(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (timetable_id, period_id, day_of_week)
);

-- ============================================================
-- 7. timetable_substitutions — per-date teacher swaps
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timetable_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  original_teacher_id BIGINT NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  substitute_teacher_id BIGINT NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id BIGINT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  reason TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled')),
  created_by UUID,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. timetable_audit_logs — change trail per timetable
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timetable_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  changes JSONB NOT NULL
);

-- ============================================================
-- RLS: enable on all new tables
-- ============================================================

ALTER TABLE public.school_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_audit_logs ENABLE ROW LEVEL SECURITY;

-- school_periods: school members can read; admins can write
CREATE POLICY "school_periods_select" ON public.school_periods
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_periods_insert" ON public.school_periods
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_periods_update" ON public.school_periods
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_periods_delete" ON public.school_periods
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));

-- special_rooms
CREATE POLICY "special_rooms_select" ON public.special_rooms
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "special_rooms_insert" ON public.special_rooms
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "special_rooms_update" ON public.special_rooms
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "special_rooms_delete" ON public.special_rooms
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));

-- school_calendar_events
CREATE POLICY "calendar_events_select" ON public.school_calendar_events
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "calendar_events_insert" ON public.school_calendar_events
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "calendar_events_update" ON public.school_calendar_events
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "calendar_events_delete" ON public.school_calendar_events
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));

-- timetables
CREATE POLICY "timetables_select" ON public.timetables
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "timetables_insert" ON public.timetables
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "timetables_update" ON public.timetables
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "timetables_delete" ON public.timetables
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));

-- timetable_slots (scoped via timetable)
CREATE POLICY "timetable_slots_select" ON public.timetable_slots
  FOR SELECT USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "timetable_slots_insert" ON public.timetable_slots
  FOR INSERT WITH CHECK (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "timetable_slots_update" ON public.timetable_slots
  FOR UPDATE USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "timetable_slots_delete" ON public.timetable_slots
  FOR DELETE USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

-- timetable_substitutions
CREATE POLICY "substitutions_select" ON public.timetable_substitutions
  FOR SELECT USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "substitutions_insert" ON public.timetable_substitutions
  FOR INSERT WITH CHECK (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "substitutions_update" ON public.timetable_substitutions
  FOR UPDATE USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

-- timetable_audit_logs
CREATE POLICY "audit_logs_select" ON public.timetable_audit_logs
  FOR SELECT USING (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );

CREATE POLICY "audit_logs_insert" ON public.timetable_audit_logs
  FOR INSERT WITH CHECK (
    timetable_id IN (
      SELECT id FROM public.timetables
      WHERE school_id = (SELECT public.get_user_school_id())
    )
  );
