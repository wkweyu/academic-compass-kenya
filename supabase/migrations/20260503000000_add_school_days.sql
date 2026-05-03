-- Migration: 20260503000000_add_school_days.sql
-- Adds a per-school configurable working-days table.
-- Eliminates hardcoded Mon-Fri assumptions in frontend and edge functions.

-- ============================================================
-- 1. school_days table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.school_days (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    BIGINT  NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  day_of_week  INT     NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  -- 1=Monday … 7=Sunday; matches timetable_slots.day_of_week convention
  name         VARCHAR(20) NOT NULL,       -- e.g. "Monday", "Saturday"
  short_name   VARCHAR(5)  NOT NULL,       -- e.g. "Mon", "Sat"
  order_index  INT     NOT NULL DEFAULT 0, -- display order; tiebreaker = day_of_week
  is_active    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (school_id, day_of_week)
);

-- ============================================================
-- 2. Row-Level Security (mirrors school_periods pattern)
-- ============================================================

ALTER TABLE public.school_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_days_select" ON public.school_days
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_days_insert" ON public.school_days
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_days_update" ON public.school_days
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "school_days_delete" ON public.school_days
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));

-- ============================================================
-- 3. Seed Mon-Fri for all existing schools
--    ON CONFLICT DO NOTHING — safe to re-run
-- ============================================================

INSERT INTO public.school_days
  (id, school_id, day_of_week, name, short_name, order_index)
SELECT
  gen_random_uuid(),
  s.id,
  v.dow,
  v.nm,
  v.sn,
  v.oi
FROM public.schools_school s
CROSS JOIN (VALUES
  (1, 'Monday',    'Mon', 0),
  (2, 'Tuesday',   'Tue', 1),
  (3, 'Wednesday', 'Wed', 2),
  (4, 'Thursday',  'Thu', 3),
  (5, 'Friday',    'Fri', 4)
) AS v(dow, nm, sn, oi)
ON CONFLICT (school_id, day_of_week) DO NOTHING;
