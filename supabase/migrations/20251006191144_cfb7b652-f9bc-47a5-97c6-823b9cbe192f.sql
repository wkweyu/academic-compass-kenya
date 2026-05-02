-- =====================================================
-- SECURITY FIX: Implement Role-Based Access Control
-- =====================================================
-- This migration creates a proper RBAC system to restrict
-- user data visibility based on roles

-- =====================================================
-- 1. CREATE ROLE ENUM
-- =====================================================
CREATE TYPE public.app_role AS ENUM (
  'superadmin',
  'schooladmin', 
  'finance',
  'transport',
  'teacher',
  'parent'
);

-- =====================================================
-- 2. CREATE USER ROLES TABLE
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. CREATE SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- =====================================================
-- This function checks if a user has a specific role
-- SECURITY DEFINER allows it to bypass RLS and prevent recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin (schooladmin or superadmin)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('superadmin', 'schooladmin')
  )
$$;

-- =====================================================
-- 4. UPDATE USERS TABLE RLS POLICIES
-- =====================================================
-- Drop existing permissive policy
DROP POLICY IF EXISTS "Users can view users from their school" ON public.users;

-- Users can ALWAYS view their own profile
CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT
TO authenticated
USING (id::text = auth.uid()::text);

-- Only admins can view all users from their school
CREATE POLICY "Admins can view all users from their school"
ON public.users FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id()
  AND public.is_admin(auth.uid())
);

-- Keep existing update policy (users can only update their own profile)
-- This policy already exists and is correctly restrictive

-- =====================================================
-- 5. CREATE RLS POLICIES FOR USER_ROLES TABLE
-- =====================================================

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can view all roles from their school
CREATE POLICY "Admins can view all roles from their school"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id::text = user_roles.user_id::text
    AND users.school_id = public.get_user_school_id()
  )
);

-- Only superadmins can insert/update/delete roles
CREATE POLICY "Only superadmins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- =====================================================
-- 6. CREATE TRIGGER TO AUTO-ASSIGN ROLES ON USER CREATION
-- =====================================================
-- When a new user is created in auth.users, automatically create
-- a corresponding role entry (default to 'teacher' role)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert a default role for the new user
  -- The actual role should be set by superadmin after user creation
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();