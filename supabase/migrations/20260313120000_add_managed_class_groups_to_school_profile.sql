ALTER TABLE public.schools_school
ADD COLUMN IF NOT EXISTS managed_class_groups text[];

UPDATE public.schools_school
SET managed_class_groups = CASE
  WHEN managed_class_groups IS NOT NULL AND array_length(managed_class_groups, 1) > 0 THEN managed_class_groups
  WHEN lower(trim(COALESCE(type, ''))) IN ('mixed', 'mixed (primary & secondary)', 'mixed primary & secondary', 'primary-secondary') THEN ARRAY['primary', 'junior-secondary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) = 'pre-primary and primary' THEN ARRAY['pre-primary', 'primary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) LIKE '%pre%' AND lower(trim(COALESCE(type, ''))) LIKE '%primary%' THEN ARRAY['pre-primary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) LIKE '%senior%' AND lower(trim(COALESCE(type, ''))) LIKE '%secondary%' THEN ARRAY['senior-secondary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) LIKE '%junior%' AND lower(trim(COALESCE(type, ''))) LIKE '%secondary%' THEN ARRAY['junior-secondary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) LIKE '%secondary%' THEN ARRAY['junior-secondary']::text[]
  WHEN lower(trim(COALESCE(type, ''))) LIKE '%primary%' THEN ARRAY['primary']::text[]
  ELSE managed_class_groups
END;

CREATE OR REPLACE FUNCTION public.create_school_profile(
  p_name TEXT,
  p_address TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_type TEXT DEFAULT '',
  p_managed_class_groups TEXT[] DEFAULT NULL,
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
  new_school_id bigint;
BEGIN
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF user_school_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a school assigned';
  END IF;

  INSERT INTO public.schools_school (
    name,
    address,
    phone,
    email,
    type,
    managed_class_groups,
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
    CASE
      WHEN p_managed_class_groups IS NULL OR array_length(p_managed_class_groups, 1) IS NULL THEN NULL
      ELSE p_managed_class_groups
    END,
    p_motto,
    p_website,
    p_logo,
    true,
    NOW()
  )
  RETURNING schools_school.id INTO new_school_id;

  UPDATE public.users
  SET school_id = new_school_id,
      updated_at = NOW()
  WHERE auth_user_id = auth.uid();

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
  WHERE s.id = new_school_id;
END;
$$;

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
  managed_class_groups text[],
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
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF user_school_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.schools_school WHERE schools_school.id = user_school_id) INTO school_exists;

  IF NOT school_exists THEN
    UPDATE public.users
    SET school_id = NULL,
        updated_at = NOW()
    WHERE auth_user_id = auth.uid();

    RETURN;
  END IF;

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