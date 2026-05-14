-- =============================================================================
-- Admission Number: sequence-based generation + ADM/NNNN format + computed column
-- =============================================================================
-- Replaces MAX()-based generation (race-condition risk) with a PostgreSQL
-- sequence. Adds admission_numeric (BIGINT, STORED) for fast exact search and
-- future M-Pesa lookup. Handles all three legacy formats:
--   YYYYNNN   (e.g. 2026042)   → strip 4-char year prefix → numeric suffix
--   YYYY-NNNN (e.g. 2026-0042) → split on '-', take second part
--   ADM/NNNN  (e.g. ADM/0042)  → strip 'ADM/' prefix (4 chars)
-- =============================================================================

-- Step 1: Create sequence
CREATE SEQUENCE IF NOT EXISTS public.admission_number_seq MINVALUE 1;

-- Step 2: Initialise sequence above the current maximum so existing records
-- are never overwritten. Uses CASE-based regex extraction to handle all legacy
-- formats safely.  setval(seq, N) with is_called=true (default) means the
-- NEXT nextval() call returns N+1.
DO $$
DECLARE
  max_num BIGINT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN admission_number ~ '^ADM/\d+$'
        THEN substring(admission_number FROM 5)::bigint          -- ADM/0042 → 42
      WHEN admission_number ~ '^\d{4}-\d+$'
        THEN split_part(admission_number, '-', 2)::bigint        -- 2026-0042 → 42
      WHEN admission_number ~ '^\d{7,}$'
        THEN substring(admission_number FROM 5)::bigint          -- 2026042 → 42 (drop year prefix)
      ELSE 0
    END
  ), 0)
  INTO max_num
  FROM public.students;

  IF max_num >= 1 THEN
    -- is_called = true (default): next nextval() returns max_num + 1
    PERFORM setval('public.admission_number_seq', max_num);
  END IF;
  -- If max_num = 0 (empty table): sequence was created MINVALUE 1,
  -- first nextval() returns 1 → ADM/0001
END;
$$;

-- Step 3: Replace generate_admission_number() — atomic via sequence,
-- no MAX(), no lock needed, concurrent-safe.
CREATE OR REPLACE FUNCTION public.generate_admission_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'ADM/' || LPAD(nextval('public.admission_number_seq')::TEXT, 4, '0');
END;
$$;

-- Step 4: Add admission_numeric as a STORED generated column (BIGINT).
-- Computed once on write, index-backed reads. Works across all three
-- legacy formats so existing rows are immediately queryable.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS admission_numeric BIGINT
  GENERATED ALWAYS AS (
    CASE
      WHEN admission_number ~ '^ADM/\d+$'
        THEN substring(admission_number FROM 5)::bigint
      WHEN admission_number ~ '^\d{4}-\d+$'
        THEN split_part(admission_number, '-', 2)::bigint
      WHEN admission_number ~ '^\d{7,}$'
        THEN substring(admission_number FROM 5)::bigint
      ELSE NULL
    END
  ) STORED;

-- Step 5: Index admission_numeric for fast search and M-Pesa lookup.
CREATE INDEX IF NOT EXISTS idx_students_admission_numeric
  ON public.students (admission_numeric);
