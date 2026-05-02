-- =====================================================
-- FIX SECURITY WARNINGS - REMOVE VIEW AND FIX FUNCTIONS
-- =====================================================

-- =====================================================
-- 1. FIX GENERATE_ADMISSION_NUMBER FUNCTION - ADD SEARCH_PATH
-- =====================================================
CREATE OR REPLACE FUNCTION public.generate_admission_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  year TEXT;
  counter INTEGER;
  admission_num TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM LENGTH(year) + 2) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.students
  WHERE admission_number LIKE year || '%';
  
  -- Format as YYYY001, YYYY002, etc.
  admission_num := year || LPAD(counter::TEXT, 3, '0');
  
  RETURN admission_num;
END;
$function$;

-- =====================================================
-- 2. UPDATE COMMENTS TO REFLECT FUNCTION-ONLY APPROACH
-- =====================================================
COMMENT ON TABLE public.users IS 'CRITICAL: This table contains password hashes. DO NOT query directly. Use get_current_user_profile() or get_school_users() functions for safe access.';

COMMENT ON FUNCTION public.get_current_user_profile() IS 'Safe function to retrieve current user profile without password. Use this instead of querying users table directly.';

COMMENT ON FUNCTION public.get_school_users() IS 'Safe function for admins to retrieve all users from their school without passwords. Use this instead of querying users table directly.';