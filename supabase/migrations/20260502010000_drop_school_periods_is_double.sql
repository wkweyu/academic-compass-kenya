-- Revert school_periods.is_double (Fix #1)
-- Design rule: periods are atomic time-slots (WHEN only).
-- Double-period logic lives exclusively in class_subjects.is_double.
ALTER TABLE public.school_periods
  DROP COLUMN IF EXISTS is_double;
