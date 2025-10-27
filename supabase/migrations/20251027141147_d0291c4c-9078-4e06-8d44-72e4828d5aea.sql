-- Create a secure function to create school profile
-- This bypasses RLS entirely by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.create_school_profile(
  p_name TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_type TEXT DEFAULT '',
  p_motto TEXT DEFAULT '',
  p_website TEXT DEFAULT '',
  p_logo TEXT DEFAULT ''
)
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
  new_school_id bigint;
BEGIN
  -- Check if user already has a school
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  IF user_school_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a school assigned';
  END IF;
  
  -- Create the school
  INSERT INTO public.schools_school (
    name,
    address,
    phone,
    email,
    type,
    motto,
    website,
    logo,
    active,
    created_at
  ) VALUES (
    p_name,
    p_address,
    p_phone,
    p_email,
    p_type,
    p_motto,
    p_website,
    p_logo,
    true,
    NOW()
  )
  RETURNING schools_school.id INTO new_school_id;
  
  -- Link school to user
  UPDATE public.users
  SET school_id = new_school_id,
      updated_at = NOW()
  WHERE auth_user_id = auth.uid();
  
  -- Return the created school
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
  WHERE s.id = new_school_id;
END;
$$;

-- Remove the trigger since we're handling linking in the function
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;