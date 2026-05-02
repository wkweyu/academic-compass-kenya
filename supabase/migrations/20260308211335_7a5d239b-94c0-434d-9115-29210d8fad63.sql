-- Fix teachers RLS policies to use SECURITY DEFINER school resolver
-- Existing policies query public.users directly, but direct SELECT on users is blocked by RLS,
-- causing INSERT/SELECT/UPDATE/DELETE policy checks on teachers to fail.

DROP POLICY IF EXISTS "Users can view teachers from their school" ON public.teachers;
DROP POLICY IF EXISTS "Users can create teachers for their school" ON public.teachers;
DROP POLICY IF EXISTS "Users can update teachers from their school" ON public.teachers;
DROP POLICY IF EXISTS "Users can delete teachers from their school" ON public.teachers;

CREATE POLICY "Users can view teachers from their school"
ON public.teachers
FOR SELECT
TO authenticated
USING (school_id IS NOT NULL AND school_id = public.get_user_school_id());

CREATE POLICY "Users can create teachers for their school"
ON public.teachers
FOR INSERT
TO authenticated
WITH CHECK (school_id IS NOT NULL AND school_id = public.get_user_school_id());

CREATE POLICY "Users can update teachers from their school"
ON public.teachers
FOR UPDATE
TO authenticated
USING (school_id IS NOT NULL AND school_id = public.get_user_school_id())
WITH CHECK (school_id IS NOT NULL AND school_id = public.get_user_school_id());

CREATE POLICY "Users can delete teachers from their school"
ON public.teachers
FOR DELETE
TO authenticated
USING (school_id IS NOT NULL AND school_id = public.get_user_school_id());