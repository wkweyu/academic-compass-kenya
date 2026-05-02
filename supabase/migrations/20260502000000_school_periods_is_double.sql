-- Add is_double column to school_periods
-- This marks a period block as double-length (used in PeriodSetupForm UI)
ALTER TABLE public.school_periods
  ADD COLUMN IF NOT EXISTS is_double BOOLEAN NOT NULL DEFAULT false;
