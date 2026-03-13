DROP FUNCTION IF EXISTS public.create_school_class(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.create_school_class(
  p_name TEXT,
  p_grade_level INTEGER,
  p_description TEXT DEFAULT ''
)
RETURNS TABLE(
  id bigint,
  name text,
  grade_level integer,
  description text,
  school_id bigint,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id bigint;
  existing_class_id bigint;
BEGIN
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;

  SELECT c.id INTO existing_class_id
  FROM public.classes c
  WHERE c.school_id = user_school_id
    AND (
      c.grade_level = p_grade_level
      OR lower(trim(c.name)) = lower(trim(p_name))
    )
  ORDER BY c.id
  LIMIT 1;

  IF existing_class_id IS NULL THEN
    INSERT INTO public.classes (
      name,
      grade_level,
      description,
      school_id
    ) VALUES (
      p_name,
      p_grade_level,
      COALESCE(p_description, ''),
      user_school_id
    )
    RETURNING classes.id INTO existing_class_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name::text,
    c.grade_level,
    c.description::text,
    c.school_id,
    c.created_at
  FROM public.classes c
  WHERE c.id = existing_class_id;
END;
$$;