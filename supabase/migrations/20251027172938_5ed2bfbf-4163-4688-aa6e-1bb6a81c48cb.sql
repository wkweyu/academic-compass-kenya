-- Enable RLS on students table if not already enabled
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS "Users can view students from their school" ON public.students;
DROP POLICY IF EXISTS "Users can create students for their school" ON public.students;
DROP POLICY IF EXISTS "Users can update students from their school" ON public.students;
DROP POLICY IF EXISTS "Users can delete students from their school" ON public.students;

-- Create RLS policies for students table
CREATE POLICY "Users can view students from their school"
  ON public.students
  FOR SELECT
  USING (school_id = get_user_school_id());

CREATE POLICY "Users can create students for their school"
  ON public.students
  FOR INSERT
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can update students from their school"
  ON public.students
  FOR UPDATE
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can delete students from their school"
  ON public.students
  FOR DELETE
  USING (school_id = get_user_school_id());