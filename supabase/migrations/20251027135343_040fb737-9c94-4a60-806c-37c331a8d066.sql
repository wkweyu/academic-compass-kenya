-- Fix missing defaults for classes table
ALTER TABLE public.classes 
ALTER COLUMN description SET DEFAULT '',
ALTER COLUMN created_at SET DEFAULT NOW();

-- Fix missing defaults for streams table  
ALTER TABLE public.streams 
ALTER COLUMN created_at SET DEFAULT NOW();

-- Fix missing defaults for students table
ALTER TABLE public.students 
ALTER COLUMN is_active SET DEFAULT true,
ALTER COLUMN is_on_transport SET DEFAULT false,
ALTER COLUMN kcpe_index SET DEFAULT '',
ALTER COLUMN guardian_email SET DEFAULT '',
ALTER COLUMN created_at SET DEFAULT NOW(),
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Create trigger to auto-update updated_at for students
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();