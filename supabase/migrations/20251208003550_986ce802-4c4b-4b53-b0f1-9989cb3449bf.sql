-- Fix existing teachers by assigning them to school_id 44 (the user's school)
UPDATE public.teachers 
SET school_id = 44 
WHERE school_id IS NULL;