-- Add function to auto-generate unique school codes
CREATE OR REPLACE FUNCTION public.generate_school_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a 6-character code: SCH + 3 random digits
    new_code := 'SCH' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM schools_school WHERE code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Add default value for code column using the generation function
ALTER TABLE public.schools_school 
ALTER COLUMN code SET DEFAULT public.generate_school_code();

-- Also make sure created_at has a default
ALTER TABLE public.schools_school 
ALTER COLUMN created_at SET DEFAULT NOW();

-- And active defaults to true
ALTER TABLE public.schools_school 
ALTER COLUMN active SET DEFAULT true;