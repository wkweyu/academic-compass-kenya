-- Create a function to create students (similar to create_school_profile)
CREATE OR REPLACE FUNCTION public.create_student(
  p_full_name TEXT,
  p_gender TEXT,
  p_date_of_birth DATE,
  p_guardian_name TEXT,
  p_guardian_phone TEXT,
  p_guardian_email TEXT,
  p_guardian_relationship TEXT,
  p_current_class_id BIGINT,
  p_current_stream_id BIGINT,
  p_level TEXT,
  p_admission_year INTEGER,
  p_is_on_transport BOOLEAN DEFAULT false,
  p_photo TEXT DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  admission_number TEXT,
  full_name TEXT,
  gender TEXT,
  date_of_birth DATE,
  guardian_name TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  guardian_relationship TEXT,
  current_class_id BIGINT,
  current_stream_id BIGINT,
  level TEXT,
  admission_year INTEGER,
  is_on_transport BOOLEAN,
  is_active BOOLEAN,
  photo TEXT,
  school_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id BIGINT;
  new_student_id BIGINT;
BEGIN
  -- Get user's school ID
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;
  
  -- Create the student
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
  
  -- Return the created student
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
$$;