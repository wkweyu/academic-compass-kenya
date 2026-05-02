-- Timetable DB Helpers: functions, indexes, triggers
-- Migration: 20260501010000_timetable_db_helpers.sql

-- ============================================================
-- 1. get_teacher_occupied_slots
--    Returns all day+period combos where any of the given teachers
--    are already assigned in published/draft timetables for the term/year.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_teacher_occupied_slots(
  teacher_ids BIGINT[],
  p_term INT,
  p_year INT
)
RETURNS TABLE(teacher_id BIGINT, day_of_week INT, period_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ts.teacher_id,
    ts.day_of_week,
    ts.period_id
  FROM public.timetable_slots ts
  JOIN public.timetables t ON t.id = ts.timetable_id
  WHERE ts.teacher_id = ANY(teacher_ids)
    AND t.term = p_term
    AND t.academic_year = p_year
    AND t.status != 'archived'
    AND ts.teacher_id IS NOT NULL;
$$;

-- ============================================================
-- 2. get_special_room_occupied_slots
--    Returns all day+period combos where any of the given rooms
--    are already booked in published/draft timetables.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_special_room_occupied_slots(
  room_ids UUID[],
  p_term INT,
  p_year INT
)
RETURNS TABLE(special_room_id UUID, day_of_week INT, period_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ts.special_room_id,
    ts.day_of_week,
    ts.period_id
  FROM public.timetable_slots ts
  JOIN public.timetables t ON t.id = ts.timetable_id
  WHERE ts.special_room_id = ANY(room_ids)
    AND t.term = p_term
    AND t.academic_year = p_year
    AND t.status != 'archived'
    AND ts.special_room_id IS NOT NULL;
$$;

-- ============================================================
-- 3. get_teacher_weekly_load
--    Returns the total number of slots already assigned to each
--    teacher across ALL published/draft timetables for term+year.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_teacher_weekly_load(
  teacher_ids BIGINT[],
  p_term INT,
  p_year INT
)
RETURNS TABLE(teacher_id BIGINT, assigned_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ts.teacher_id,
    COUNT(*) AS assigned_count
  FROM public.timetable_slots ts
  JOIN public.timetables t ON t.id = ts.timetable_id
  WHERE ts.teacher_id = ANY(teacher_ids)
    AND t.term = p_term
    AND t.academic_year = p_year
    AND t.status != 'archived'
    AND ts.teacher_id IS NOT NULL
  GROUP BY ts.teacher_id;
$$;

-- ============================================================
-- 4. get_special_room_usage_count
--    Returns how many slots each room is assigned this term/year,
--    used for least-used room selection.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_special_room_usage_count(
  room_ids UUID[],
  p_term INT,
  p_year INT
)
RETURNS TABLE(special_room_id UUID, usage_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ts.special_room_id,
    COUNT(*) AS usage_count
  FROM public.timetable_slots ts
  JOIN public.timetables t ON t.id = ts.timetable_id
  WHERE ts.special_room_id = ANY(room_ids)
    AND t.term = p_term
    AND t.academic_year = p_year
    AND t.status != 'archived'
    AND ts.special_room_id IS NOT NULL
  GROUP BY ts.special_room_id;
$$;

-- ============================================================
-- 5. is_teacher_qualified
--    Returns TRUE if the teacher has a specialization for the subject.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_teacher_qualified(
  p_teacher_id BIGINT,
  p_subject_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_specializations
    WHERE teacher_id = p_teacher_id
      AND subject_id = p_subject_id
  );
$$;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_timetable_slots_timetable_day_period
  ON public.timetable_slots (timetable_id, day_of_week, period_id);

CREATE INDEX IF NOT EXISTS idx_timetable_slots_teacher
  ON public.timetable_slots (teacher_id)
  WHERE teacher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timetable_slots_special_room
  ON public.timetable_slots (special_room_id)
  WHERE special_room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_school_dates
  ON public.school_calendar_events (school_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timetable_time
  ON public.timetable_audit_logs (timetable_id, timestamp DESC);

-- Fast substitution overlay lookups (slot + date)
CREATE INDEX IF NOT EXISTS idx_substitutions_slot_date
  ON public.timetable_substitutions (slot_id, date);

-- ============================================================
-- Trigger: auto-update updated_at on timetables
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER timetables_set_updated_at
  BEFORE UPDATE ON public.timetables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER timetable_slots_set_updated_at
  BEFORE UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Trigger: enforce that timetable_slots.period_id belongs to
-- the same school as the timetable (period-school scope safety)
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_period_school_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_timetable_school_id BIGINT;
  v_period_school_id BIGINT;
BEGIN
  SELECT school_id INTO v_timetable_school_id
  FROM public.timetables
  WHERE id = NEW.timetable_id;

  SELECT school_id INTO v_period_school_id
  FROM public.school_periods
  WHERE id = NEW.period_id;

  IF v_timetable_school_id IS DISTINCT FROM v_period_school_id THEN
    RAISE EXCEPTION 'period_id % does not belong to school_id % (timetable school)',
      NEW.period_id, v_timetable_school_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_period_school_scope
  BEFORE INSERT OR UPDATE ON public.timetable_slots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_school_scope();
