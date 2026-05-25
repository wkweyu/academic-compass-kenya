-- Backfill admission_year for students where it is NULL
-- students table has no admission_date/enrollment_date; use created_at as proxy
UPDATE students
SET admission_year = EXTRACT(YEAR FROM created_at)::integer
WHERE admission_year IS NULL;
