-- =============================================================
-- Migration: 20260502020000_timetable_school_gen
-- Purpose  : Extend timetables table for school-wide generation
-- =============================================================

-- 1. Add 'staging' to status CHECK constraint
ALTER TABLE public.timetables DROP CONSTRAINT IF EXISTS timetables_status_check;
ALTER TABLE public.timetables
  ADD CONSTRAINT timetables_status_check
  CHECK (status IN ('staging', 'draft', 'published', 'archived'));

-- 2. Add generation_id column (nullable; class-mode rows remain unaffected)
ALTER TABLE public.timetables
  ADD COLUMN IF NOT EXISTS generation_id UUID DEFAULT NULL;

-- 3. Partial unique index for idempotent Save-All retries
--    COALESCE(stream_id,-1) ensures NULL stream rows also de-duplicate correctly
--    (PostgreSQL treats NULL != NULL in indexes, so we normalise nulls to -1).
CREATE UNIQUE INDEX IF NOT EXISTS timetables_generation_id_unique
  ON public.timetables (school_id, class_id, COALESCE(stream_id,-1), academic_year, term, generation_id)
  WHERE generation_id IS NOT NULL;
