-- Migration: 20260504000000_add_subject_constraints.sql
-- Adds per-school subject scheduling constraints table.
-- Enforces sequencing and gap rules during timetable generation.

-- ============================================================
-- 1. subject_constraints table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subject_constraints (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       BIGINT      NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  subject_a_id    BIGINT      NOT NULL REFERENCES public.subjects(id),
  subject_b_id    BIGINT      NOT NULL REFERENCES public.subjects(id),
  constraint_type VARCHAR(30) NOT NULL CHECK (constraint_type IN ('no_consecutive', 'no_same_day', 'preferred_gap')),
  min_gap         INT         NULL,
  is_hard         BOOLEAN     NOT NULL DEFAULT false,
  priority        INT         NOT NULL DEFAULT 5,

  -- Canonical ordering: always store the smaller id first to prevent duplicates
  CONSTRAINT chk_subject_order   CHECK (subject_a_id < subject_b_id),
  CONSTRAINT chk_subject_diff    CHECK (subject_a_id != subject_b_id),
  CONSTRAINT chk_min_gap         CHECK (min_gap IS NULL OR min_gap > 0),
  CONSTRAINT uq_constraint       UNIQUE (school_id, subject_a_id, subject_b_id, constraint_type)
);

-- ============================================================
-- 2. Indexes
-- ============================================================

CREATE INDEX idx_subject_constraints_school    ON public.subject_constraints (school_id);
CREATE INDEX idx_subject_constraints_subject_a ON public.subject_constraints (subject_a_id);
CREATE INDEX idx_subject_constraints_subject_b ON public.subject_constraints (subject_b_id);

-- ============================================================
-- 3. Row-Level Security
-- ============================================================

ALTER TABLE public.subject_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subject_constraints_select" ON public.subject_constraints
  FOR SELECT USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "subject_constraints_insert" ON public.subject_constraints
  FOR INSERT WITH CHECK (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "subject_constraints_update" ON public.subject_constraints
  FOR UPDATE USING (school_id = (SELECT public.get_user_school_id()));

CREATE POLICY "subject_constraints_delete" ON public.subject_constraints
  FOR DELETE USING (school_id = (SELECT public.get_user_school_id()));
