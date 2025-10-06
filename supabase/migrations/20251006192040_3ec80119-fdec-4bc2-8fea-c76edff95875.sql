-- =====================================================
-- SECURITY FIX: Prevent Password Hash Exposure in Users Table
-- =====================================================
-- This migration prevents the password column from being exposed
-- while maintaining proper access control for user profiles

-- =====================================================
-- 1. CREATE SAFE USER PROFILES VIEW (WITHOUT PASSWORD)
-- =====================================================
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT 
  id,
  username,
  email,
  first_name,
  last_name,
  phone,
  role,
  school_id,
  is_active,
  is_staff,
  is_superuser,
  date_joined,
  last_login,
  created_at,
  updated_at
FROM public.users;

-- Add comment to view
COMMENT ON VIEW public.user_profiles IS 'Safe view of user data that excludes sensitive password information. Use this view instead of querying users table directly.';

-- =====================================================
-- 2. REVOKE DIRECT SELECT ON USERS TABLE
-- =====================================================
-- First, drop existing SELECT policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users from their school" ON public.users;

-- Create a restrictive policy that blocks ALL direct SELECT on users table
CREATE POLICY "Block direct SELECT on users table"
ON public.users FOR SELECT
TO authenticated
USING (false);

-- =====================================================
-- 3. CREATE SECURITY DEFINER FUNCTIONS FOR SAFE ACCESS
-- =====================================================

-- Function to get current user's profile (without password)
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE (
  id bigint,
  username text,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text,
  school_id bigint,
  is_active boolean,
  is_staff boolean,
  is_superuser boolean,
  date_joined timestamptz,
  last_login timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id::bigint,
    u.username::text,
    u.email::text,
    u.first_name::text,
    u.last_name::text,
    u.phone::text,
    u.role::text,
    u.school_id,
    u.is_active,
    u.is_staff,
    u.is_superuser,
    u.date_joined,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.id::text = auth.uid()::text;
$$;

-- Function to get school users for admins (without passwords)
CREATE OR REPLACE FUNCTION public.get_school_users()
RETURNS TABLE (
  id bigint,
  username text,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text,
  school_id bigint,
  is_active boolean,
  is_staff boolean,
  is_superuser boolean,
  date_joined timestamptz,
  last_login timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id::bigint,
    u.username::text,
    u.email::text,
    u.first_name::text,
    u.last_name::text,
    u.phone::text,
    u.role::text,
    u.school_id,
    u.is_active,
    u.is_staff,
    u.is_superuser,
    u.date_joined,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.school_id = public.get_user_school_id()
    AND public.is_admin(auth.uid());
$$;

-- =====================================================
-- 4. GRANT PERMISSIONS ON VIEW AND FUNCTIONS
-- =====================================================

-- Grant SELECT on the safe view
GRANT SELECT ON public.user_profiles TO authenticated;

-- Grant EXECUTE on the safe functions
GRANT EXECUTE ON FUNCTION public.get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_users() TO authenticated;

-- =====================================================
-- 5. ADD SECURITY WARNINGS TO USERS TABLE
-- =====================================================

COMMENT ON TABLE public.users IS 'CRITICAL: This table contains password hashes. DO NOT query directly. Use user_profiles view or get_current_user_profile()/get_school_users() functions instead.';

COMMENT ON COLUMN public.users.password IS 'SECURITY: Password hash - MUST NEVER be exposed in any query results. Use safe functions or views for user data access.';