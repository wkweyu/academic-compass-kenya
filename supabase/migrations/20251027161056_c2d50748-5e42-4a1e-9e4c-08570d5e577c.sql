-- Fix the create_student function to resolve ambiguous school_id reference
CREATE OR REPLACE FUNCTION public.create_student(
  p_full_name text,
  p_gender text,
  p_date_of_birth date,
  p_guardian_name text,
  p_guardian_phone text,
  p_guardian_email text,
  p_guardian_relationship text,
  p_current_class_id bigint,
  p_current_stream_id bigint,
  p_level text,
  p_admission_year integer,
  p_is_on_transport boolean DEFAULT false,
  p_photo text DEFAULT NULL::text
)
RETURNS TABLE(
  id bigint,
  admission_number text,
  full_name text,
  gender text,
  date_of_birth date,
  guardian_name text,
  guardian_phone text,
  guardian_email text,
  guardian_relationship text,
  current_class_id bigint,
  current_stream_id bigint,
  level text,
  admission_year integer,
  is_on_transport boolean,
  is_active boolean,
  photo text,
  school_id bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_school_id BIGINT;
  new_student_id BIGINT;
BEGIN
  -- Get user's school ID
  SELECT u.school_id INTO user_school_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();
  
  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;
  
  -- Create the student with fully qualified column references
  INSERT INTO public.students (
    school_id,
    full_name,
    gender,
    date_of_birth,
    guardian_name,
    guardian_phone,
    guardian_email,
    guardian_relationship,
    current_class_id,
    current_stream_id,
    level,
    admission_year,
    is_on_transport,
    is_active,
    photo,
    created_at,
    updated_at
  ) VALUES (
    user_school_id,
    p_full_name,
    p_gender,
    p_date_of_birth,
    p_guardian_name,
    p_guardian_phone,
    p_guardian_email,
    p_guardian_relationship,
    p_current_class_id,
    p_current_stream_id,
    p_level,
    p_admission_year,
    p_is_on_transport,
    true,
    p_photo,
    NOW(),
    NOW()
  )
  RETURNING students.id INTO new_student_id;
  
  -- Return the created student with fully qualified column references
  RETURN QUERY
  SELECT 
    s.id,
    s.admission_number::TEXT,
    s.full_name::TEXT,
    s.gender::TEXT,
    s.date_of_birth,
    s.guardian_name::TEXT,
    s.guardian_phone::TEXT,
    s.guardian_email::TEXT,
    s.guardian_relationship::TEXT,
    s.current_class_id,
    s.current_stream_id,
    s.level::TEXT,
    s.admission_year,
    s.is_on_transport,
    s.is_active,
    s.photo::TEXT,
    s.school_id,
    s.created_at,
    s.updated_at
  FROM public.students s
  WHERE s.id = new_student_id;
END;
$function$;