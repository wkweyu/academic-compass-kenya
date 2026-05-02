-- Set admission_number to auto-generate using existing function
ALTER TABLE public.students 
ALTER COLUMN admission_number SET DEFAULT public.generate_admission_number();