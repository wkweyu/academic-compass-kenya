-- Increase the level column length to accommodate longer level names
ALTER TABLE public.students 
ALTER COLUMN level TYPE character varying(50);

-- Add index for guardian phone for efficient sibling lookup
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON public.students(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_students_guardian_email ON public.students(guardian_email);