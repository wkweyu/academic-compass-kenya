-- Fix security issue: Implement role-based access control for students table
-- This replaces overly permissive school_id-only policies with role-based restrictions

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view students from their school" ON public.students;
DROP POLICY IF EXISTS "Users can create students for their school" ON public.students;
DROP POLICY IF EXISTS "Users can update students from their school" ON public.students;
DROP POLICY IF EXISTS "Users can delete students from their school" ON public.students;

-- Create role-based SELECT policy
-- Admins can view all students in their school
-- Teachers can view students in classes they're assigned to (via classes table bridge)
-- Other users have no access (principle of least privilege)
CREATE POLICY "Role-based student viewing"
ON public.students
FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id()
  AND (
    -- Allow admins to view all students in their school
    public.is_admin(auth.uid())
    OR
    -- Allow teachers to view students in classes they teach
    (
      public.has_role(auth.uid(), 'teacher')
      AND EXISTS (
        SELECT 1 
        FROM public.class_subject_allocations csa
        JOIN public.classes c ON c.id::text = csa.class_id::text
        WHERE csa.teacher_id::text = auth.uid()::text
          AND c.id = students.current_class_id
          AND c.school_id = students.school_id
      )
    )
  )
);

-- Only admins can create students
CREATE POLICY "Admins can create students"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid()) 
  AND school_id = public.get_user_school_id()
);

-- Only admins can update students
CREATE POLICY "Admins can update students"
ON public.students
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid()) 
  AND school_id = public.get_user_school_id()
)
WITH CHECK (
  public.is_admin(auth.uid()) 
  AND school_id = public.get_user_school_id()
);

-- Only admins can delete students
CREATE POLICY "Admins can delete students"
ON public.students
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid()) 
  AND school_id = public.get_user_school_id()
);