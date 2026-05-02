-- =====================================================
-- Fix RLS policies for schools_school and settings tables
-- Addresses CRUD issues with school profile and settings
-- =====================================================

-- ============= SCHOOLS_SCHOOL TABLE =============
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Authenticated users can create school" ON public.schools_school;
DROP POLICY IF EXISTS "Users can create their own school" ON public.schools_school;
DROP POLICY IF EXISTS "Users can view their own school" ON public.schools_school;
DROP POLICY IF EXISTS "Users can update their own school" ON public.schools_school;

-- Create improved policies for schools_school
-- Allow INSERT for users without a school (prevents duplicate schools per user)
CREATE POLICY "Users without school can create one"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (
  -- Only allow if user doesn't have a school yet
  NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id::text = auth.uid()::text 
      AND users.school_id IS NOT NULL
  )
);

-- Allow SELECT for users to view their own school
-- Also allow SELECT immediately after INSERT (before trigger commits) by checking if user created it
CREATE POLICY "Users can view their school"
ON public.schools_school
FOR SELECT
TO authenticated
USING (
  id = get_user_school_id()
);

-- Allow UPDATE for users to update their own school
CREATE POLICY "Users can update their school"
ON public.schools_school
FOR UPDATE
TO authenticated
USING (id = get_user_school_id())
WITH CHECK (id = get_user_school_id());

-- Maintain DELETE restriction (schools should not be deleted)
-- Policy already exists: "Prevent users from deleting schools"

-- ============= SETTINGS_TERMSETTING TABLE =============
-- Ensure proper RLS policies exist for term settings
-- Check and recreate if needed
DROP POLICY IF EXISTS "Users can manage term settings from their school" ON public.settings_termsetting;

CREATE POLICY "Users can view term settings from their school"
ON public.settings_termsetting
FOR SELECT
TO authenticated
USING (school_id = get_user_school_id());

CREATE POLICY "Users can create term settings for their school"
ON public.settings_termsetting
FOR INSERT
TO authenticated
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can update term settings from their school"
ON public.settings_termsetting
FOR UPDATE
TO authenticated
USING (school_id = get_user_school_id())
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can delete term settings from their school"
ON public.settings_termsetting
FOR DELETE
TO authenticated
USING (school_id = get_user_school_id());

-- ============= IMPROVE SCHOOL LINKING FUNCTION =============
-- Recreate the function to ensure it handles edge cases
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the current user's school_id to point to the newly created school
  -- Only if they don't have a school yet (defensive check)
  UPDATE public.users
  SET school_id = NEW.id
  WHERE id::text = auth.uid()::text
    AND (school_id IS NULL OR school_id = NEW.id);
  
  -- Log for debugging (will appear in postgres logs)
  RAISE NOTICE 'Linked school % to user %', NEW.id, auth.uid();
  
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;
CREATE TRIGGER after_school_insert_link_user
  AFTER INSERT ON public.schools_school
  FOR EACH ROW
  EXECUTE FUNCTION public.link_school_to_user();

-- ============= ADD HELPER FUNCTION FOR SCHOOL PROFILE =============
-- Create a function to safely get or create school profile
CREATE OR REPLACE FUNCTION public.get_or_create_school_profile()
RETURNS TABLE (
  id bigint,
  name text,
  code text,
  address text,
  phone text,
  email text,
  logo text,
  active boolean,
  created_at timestamptz,
  type text,
  motto text,
  website text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_school_id bigint;
BEGIN
  -- Get the user's school_id
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE id::text = auth.uid()::text;
  
  -- If no school_id, return empty result
  IF user_school_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the school profile
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
  WHERE s.id = user_school_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_or_create_school_profile() TO authenticated;

-- ============= COMMENTS FOR DOCUMENTATION =============
COMMENT ON POLICY "Users without school can create one" ON public.schools_school 
IS 'Allows authenticated users to create ONE school if they don''t already have one';

COMMENT ON POLICY "Users can view their school" ON public.schools_school 
IS 'Allows users to view their associated school profile';

COMMENT ON POLICY "Users can update their school" ON public.schools_school 
IS 'Allows users to update their own school profile information';

COMMENT ON FUNCTION public.link_school_to_user() 
IS 'Trigger function that automatically links a newly created school to the user who created it';

COMMENT ON FUNCTION public.get_or_create_school_profile() 
IS 'Helper function to safely retrieve school profile for the current user';