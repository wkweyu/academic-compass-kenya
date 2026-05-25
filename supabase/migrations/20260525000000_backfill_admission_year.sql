-- Backfill admission_year for students where it is NULL
-- Priority 1: derive from admission_date if available
UPDATE students
SET admission_year = EXTRACT(YEAR FROM admission_date::date)::integer
WHERE admission_year IS NULL
  AND admission_date IS NOT NULL;

-- Priority 2: derive from created_at for any remaining NULL rows
UPDATE students
SET admission_year = EXTRACT(YEAR FROM created_at)::integer
WHERE admission_year IS NULL;
