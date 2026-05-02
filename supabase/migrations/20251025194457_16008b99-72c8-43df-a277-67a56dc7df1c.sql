-- Fix RLS policy for school creation
-- The issue is that the current policy checks for users.school_id but doesn't ensure the user exists in the users table

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users without school can create one" ON public.schools_school;

-- Create a better INSERT policy that handles user creation properly
CREATE POLICY "Users can create school if they don't have one"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (
  -- Check that either:
  -- 1. User doesn't exist in users table yet (first time user)
  -- 2. User exists but has no school_id set
  NOT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND school_id IS NOT NULL
  )
);