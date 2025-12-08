-- Drop existing policies
DROP POLICY IF EXISTS "Users can view teacher subjects from their school" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Users can create teacher subjects for their school" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Users can update teacher subjects from their school" ON public.teacher_subjects;
DROP POLICY IF EXISTS "Users can delete teacher subjects from their school" ON public.teacher_subjects;

-- Recreate policies for authenticated users
CREATE POLICY "Users can view teacher subjects from their school" 
ON public.teacher_subjects 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_subjects.teacher_id
    AND t.school_id = get_user_school_id()
  )
);

CREATE POLICY "Users can create teacher subjects for their school" 
ON public.teacher_subjects 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_subjects.teacher_id
    AND t.school_id = get_user_school_id()
  )
);

CREATE POLICY "Users can update teacher subjects from their school" 
ON public.teacher_subjects 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_subjects.teacher_id
    AND t.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_subjects.teacher_id
    AND t.school_id = get_user_school_id()
  )
);

CREATE POLICY "Users can delete teacher subjects from their school" 
ON public.teacher_subjects 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = teacher_subjects.teacher_id
    AND t.school_id = get_user_school_id()
  )
);