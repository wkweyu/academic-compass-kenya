-- Add unique constraint for score upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_exam_student_unique'
  ) THEN
    ALTER TABLE public.scores ADD CONSTRAINT scores_exam_student_unique UNIQUE (exam_id, student_id);
  END IF;
END $$;

-- Add missing columns to student_reports if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'school_id' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN school_id BIGINT REFERENCES public.schools_school(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'term_id' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN term_id BIGINT REFERENCES public.settings_termsetting(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'total_possible_marks' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN total_possible_marks NUMERIC(10, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'average_percentage' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN average_percentage NUMERIC(5, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'average_points' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN average_points NUMERIC(4, 2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'total_students_in_class' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN total_students_in_class INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'total_students_in_stream' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN total_students_in_stream INTEGER;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'teacher_remarks' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN teacher_remarks TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'principal_remarks' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN principal_remarks TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_reports' AND column_name = 'created_at' AND table_schema = 'public') THEN
    ALTER TABLE public.student_reports ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on student_reports if not already
ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy
DROP POLICY IF EXISTS "Users can manage reports from their school" ON public.student_reports;
CREATE POLICY "Users can manage reports from their school"
  ON public.student_reports
  FOR ALL
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

-- Create CBC grading function
CREATE OR REPLACE FUNCTION public.calculate_cbc_grade(percentage NUMERIC)
RETURNS TABLE(grade VARCHAR(2), points INTEGER, description TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF percentage >= 75 THEN
    RETURN QUERY SELECT 'EE'::VARCHAR(2), 4, 'Exceeding Expectations'::TEXT;
  ELSIF percentage >= 50 THEN
    RETURN QUERY SELECT 'ME'::VARCHAR(2), 3, 'Meeting Expectations'::TEXT;
  ELSIF percentage >= 25 THEN
    RETURN QUERY SELECT 'AE'::VARCHAR(2), 2, 'Approaching Expectations'::TEXT;
  ELSE
    RETURN QUERY SELECT 'BE'::VARCHAR(2), 1, 'Below Expectations'::TEXT;
  END IF;
END;
$$;