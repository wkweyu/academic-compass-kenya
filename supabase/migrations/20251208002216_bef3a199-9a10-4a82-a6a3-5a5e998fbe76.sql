-- Add default values for created_at and updated_at in subjects table
ALTER TABLE public.subjects 
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Also set description to have a default empty string if null
ALTER TABLE public.subjects 
ALTER COLUMN description SET DEFAULT '';

-- Create trigger to auto-update updated_at
CREATE OR REPLACE TRIGGER update_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW
EXECUTE FUNCTION public.update_subject_tables_updated_at();