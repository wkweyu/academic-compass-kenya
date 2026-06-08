-- Fix verify_user_school to also match by email when auth_user_id link is missing.
-- This handles Django-provisioned users whose public.users.auth_user_id was not yet
-- synced with the Supabase auth.users UUID.
CREATE OR REPLACE FUNCTION public.verify_user_school(p_school_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND school_id = p_school_id
      AND is_active = true
  )
  OR EXISTS (
    -- Fallback: match by email when auth_user_id link is missing or stale.
    -- This covers Django-provisioned users whose auth_user_id was not yet synced.
    SELECT 1
    FROM public.users u
    JOIN auth.users au ON LOWER(au.email) = LOWER(u.email)
    WHERE au.id = auth.uid()
      AND u.school_id = p_school_id
      AND u.is_active = true
  );
$$;
