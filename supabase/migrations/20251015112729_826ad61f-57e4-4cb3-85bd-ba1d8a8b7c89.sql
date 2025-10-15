-- Fix orphaned school_id references and improve school profile creation flow

-- Drop and recreate the get_or_create_school_profile function with better error handling
DROP FUNCTION IF EXISTS public.get_or_create_school_profile();

CREATE OR REPLACE FUNCTION public.get_or_create_school_profile()
RETURNS TABLE(
  id bigint,
  name text,
  code text,
  address text,
  phone text,
  email text,
  logo text,
  active boolean,
  created_at timestamp with time zone,
  type text,
  motto text,
  website text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id bigint;
  school_exists boolean;
BEGIN
  -- Get the user's school_id
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE id::text = auth.uid()::text;
  
  -- If no school_id, return empty result (user needs to create one)
  IF user_school_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if the school actually exists
  SELECT EXISTS(SELECT 1 FROM public.schools_school WHERE schools_school.id = user_school_id) INTO school_exists;
  
  -- If school_id points to non-existent school, clear it and return empty
  IF NOT school_exists THEN
    UPDATE public.users
    SET school_id = NULL
    WHERE id::text = auth.uid()::text;
    
    RETURN;
  END IF;
  
  -- Return the school profile
  RETURN QUERY
  SELECT 
    s.id,
    s.name::text,
    s.code::text,
    s.address::text,
    s.phone::text,
    s.email::text,
    s.logo::text,
    s.active,
    s.created_at,
    s.type::text,
    s.motto::text,
    s.website::text
  FROM public.schools_school s
  WHERE s.id = user_school_id;
END;
$$;

-- Create a function to safely clear orphaned school references
CREATE OR REPLACE FUNCTION public.clear_orphaned_school_reference()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id bigint;
  school_exists boolean;
BEGIN
  -- Get the user's school_id
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE id::text = auth.uid()::text;
  
  -- If there is a school_id, check if it's valid
  IF user_school_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.schools_school WHERE id = user_school_id) INTO school_exists;
    
    -- If school doesn't exist, clear the reference
    IF NOT school_exists THEN
      UPDATE public.users
      SET school_id = NULL
      WHERE id::text = auth.uid()::text;
    END IF;
  END IF;
END;
$$;