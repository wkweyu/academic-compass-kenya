-- Update link_school_to_user function to work with auth_user_id
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the current user's school_id using auth_user_id
  UPDATE public.users
  SET school_id = NEW.id,
      updated_at = NOW()
  WHERE auth_user_id = auth.uid()
    AND (school_id IS NULL OR school_id = NEW.id);
  
  RAISE NOTICE 'Linked school % to user %', NEW.id, auth.uid();
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;

CREATE TRIGGER after_school_insert_link_user
  AFTER INSERT ON public.schools_school
  FOR EACH ROW
  EXECUTE FUNCTION public.link_school_to_user();

-- Update clear_orphaned_school_reference to use auth_user_id
CREATE OR REPLACE FUNCTION public.clear_orphaned_school_reference()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_school_id bigint;
  school_exists boolean;
BEGIN
  -- Get the user's school_id using auth_user_id
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  -- If there is a school_id, check if it's valid
  IF user_school_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.schools_school WHERE id = user_school_id) INTO school_exists;
    
    -- If school doesn't exist, clear the reference
    IF NOT school_exists THEN
      UPDATE public.users
      SET school_id = NULL,
          updated_at = NOW()
      WHERE auth_user_id = auth.uid();
    END IF;
  END IF;
END;
$$;

-- Update get_or_create_school_profile to use auth_user_id
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
SET search_path TO 'public'
AS $$
DECLARE
  user_school_id bigint;
  school_exists boolean;
BEGIN
  -- Get the user's school_id using auth_user_id
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  -- If no school_id, return empty result (user needs to create one)
  IF user_school_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if the school actually exists
  SELECT EXISTS(SELECT 1 FROM public.schools_school WHERE schools_school.id = user_school_id) INTO school_exists;
  
  -- If school_id points to non-existent school, clear it and return empty
  IF NOT school_exists THEN
    UPDATE public.users
    SET school_id = NULL,
        updated_at = NOW()
    WHERE auth_user_id = auth.uid();
    
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