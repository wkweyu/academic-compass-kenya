DROP FUNCTION IF EXISTS public.update_school_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_school_profile(
  p_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_managed_class_groups TEXT[] DEFAULT NULL,
  p_motto TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_logo TEXT DEFAULT NULL
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
  managed_class_groups text[],
  motto text,
  website text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id bigint;
BEGIN
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;

  UPDATE public.schools_school s
  SET
    name = COALESCE(p_name, s.name),
    address = COALESCE(p_address, s.address),
    phone = COALESCE(p_phone, s.phone),
    email = COALESCE(p_email, s.email),
    type = COALESCE(p_type, s.type),
    managed_class_groups = COALESCE(p_managed_class_groups, s.managed_class_groups),
    motto = COALESCE(p_motto, s.motto),
    website = COALESCE(p_website, s.website),
    logo = COALESCE(p_logo, s.logo)
  WHERE s.id = user_school_id;

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
    COALESCE(s.managed_class_groups, ARRAY[]::text[]),
    s.motto::text,
    s.website::text
  FROM public.schools_school s
  WHERE s.id = user_school_id;
END;
$$;