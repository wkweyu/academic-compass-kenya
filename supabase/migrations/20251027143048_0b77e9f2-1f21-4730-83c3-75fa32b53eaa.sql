-- Fix RLS policy to allow authenticated users to create students
-- Drop the restrictive admin-only INSERT policy
DROP POLICY IF EXISTS "Admins can create students" ON students;

-- Create a new policy that allows authenticated users with a school to create students
CREATE POLICY "Users can create students for their school"
ON students
FOR INSERT
TO authenticated
WITH CHECK (school_id = get_user_school_id());

-- Also update SELECT policy to allow users to view students from their school
DROP POLICY IF EXISTS "Role-based student viewing" ON students;

CREATE POLICY "Users can view students from their school"
ON students
FOR SELECT
TO authenticated
USING (school_id = get_user_school_id());