-- ====================================================
-- EXAM MANAGEMENT SYSTEM OVERHAUL
-- Session → Papers → Marks workflow with CBC grading
-- ====================================================

-- 1. Create Exam Session table (e.g., "Term 1 2025 Exams")
CREATE TABLE public.exam_sessions (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  term_id BIGINT NOT NULL REFERENCES public.settings_termsetting(id),
  academic_year INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name, academic_year)
);

-- 2. Create Exam Session Classes junction table
CREATE TABLE public.exam_session_classes (
  id BIGSERIAL PRIMARY KEY,
  exam_session_id BIGINT NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_session_id, class_id)
);

-- 3. Create Exam Papers table (subject-specific papers within a session)
CREATE TABLE public.exam_papers (
  id BIGSERIAL PRIMARY KEY,
  exam_session_id BIGINT NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES public.classes(id),
  stream_id BIGINT REFERENCES public.streams(id),
  subject_id BIGINT NOT NULL REFERENCES public.subjects(id),
  paper_name VARCHAR(255) NOT NULL,
  max_marks INTEGER NOT NULL DEFAULT 100,
  weight DECIMAL(5,2) DEFAULT 1.0,
  exam_date DATE,
  duration_minutes INTEGER DEFAULT 60,
  instructions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed', 'locked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_session_id, class_id, stream_id, subject_id, paper_name)
);

-- 4. Create Marks Entry table
CREATE TABLE public.exam_marks (
  id BIGSERIAL PRIMARY KEY,
  exam_paper_id BIGINT NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks DECIMAL(6,2),
  grade VARCHAR(5),
  points INTEGER,
  is_absent BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  entered_by BIGINT REFERENCES public.users(id),
  is_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submitted_by BIGINT REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_paper_id, student_id)
);

-- 5. Create Student Results Summary table (computed per session)
CREATE TABLE public.student_exam_results (
  id BIGSERIAL PRIMARY KEY,
  exam_session_id BIGINT NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id BIGINT NOT NULL REFERENCES public.classes(id),
  stream_id BIGINT REFERENCES public.streams(id),
  total_marks DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_possible DECIMAL(8,2) NOT NULL DEFAULT 0,
  average_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  average_points DECIMAL(4,2) NOT NULL DEFAULT 0,
  overall_grade VARCHAR(5),
  subjects_count INTEGER NOT NULL DEFAULT 0,
  class_position INTEGER,
  stream_position INTEGER,
  subject_positions JSONB DEFAULT '{}',
  teacher_comment TEXT,
  head_teacher_comment TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_session_id, student_id)
);

-- 6. Teacher Marks Entry Tracking
CREATE TABLE public.teacher_marks_progress (
  id BIGSERIAL PRIMARY KEY,
  exam_paper_id BIGINT NOT NULL REFERENCES public.exam_papers(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES public.teachers(id),
  total_students INTEGER NOT NULL DEFAULT 0,
  marks_entered INTEGER NOT NULL DEFAULT 0,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(exam_paper_id, teacher_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_session_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_marks_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_sessions
CREATE POLICY "Users can manage exam sessions from their school"
ON public.exam_sessions FOR ALL
USING (school_id = get_user_school_id())
WITH CHECK (school_id = get_user_school_id());

-- RLS Policies for exam_session_classes
CREATE POLICY "Users can manage exam session classes"
ON public.exam_session_classes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.exam_sessions es
    WHERE es.id = exam_session_classes.exam_session_id
    AND es.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.exam_sessions es
    WHERE es.id = exam_session_classes.exam_session_id
    AND es.school_id = get_user_school_id()
  )
);

-- RLS Policies for exam_papers
CREATE POLICY "Users can manage exam papers from their school"
ON public.exam_papers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.exam_sessions es
    WHERE es.id = exam_papers.exam_session_id
    AND es.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.exam_sessions es
    WHERE es.id = exam_papers.exam_session_id
    AND es.school_id = get_user_school_id()
  )
);

-- RLS Policies for exam_marks
CREATE POLICY "Users can manage exam marks for their school students"
ON public.exam_marks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = exam_marks.student_id
    AND s.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = exam_marks.student_id
    AND s.school_id = get_user_school_id()
  )
);

-- RLS Policies for student_exam_results
CREATE POLICY "Users can manage student results from their school"
ON public.student_exam_results FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_exam_results.student_id
    AND s.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_exam_results.student_id
    AND s.school_id = get_user_school_id()
  )
);

-- RLS Policies for teacher_marks_progress
CREATE POLICY "Users can view teacher marks progress from their school"
ON public.teacher_marks_progress FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = teacher_marks_progress.teacher_id
    AND t.school_id = get_user_school_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.id = teacher_marks_progress.teacher_id
    AND t.school_id = get_user_school_id()
  )
);

-- Trigger for updating timestamps
CREATE TRIGGER update_exam_sessions_updated_at
  BEFORE UPDATE ON public.exam_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exam_papers_updated_at
  BEFORE UPDATE ON public.exam_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_exam_marks_updated_at
  BEFORE UPDATE ON public.exam_marks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_student_exam_results_updated_at
  BEFORE UPDATE ON public.student_exam_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teacher_marks_progress_updated_at
  BEFORE UPDATE ON public.teacher_marks_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate CBC grade from marks
CREATE OR REPLACE FUNCTION public.get_cbc_grade(p_marks DECIMAL, p_max_marks INTEGER)
RETURNS TABLE(grade VARCHAR(5), points INTEGER, description TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  percentage DECIMAL;
BEGIN
  IF p_max_marks = 0 THEN
    RETURN QUERY SELECT 'BE'::VARCHAR(5), 1::INTEGER, 'Below Expectations'::TEXT;
    RETURN;
  END IF;
  
  percentage := (p_marks / p_max_marks) * 100;
  
  IF percentage >= 75 THEN
    RETURN QUERY SELECT 'EE'::VARCHAR(5), 4::INTEGER, 'Exceeding Expectations'::TEXT;
  ELSIF percentage >= 50 THEN
    RETURN QUERY SELECT 'ME'::VARCHAR(5), 3::INTEGER, 'Meeting Expectations'::TEXT;
  ELSIF percentage >= 25 THEN
    RETURN QUERY SELECT 'AE'::VARCHAR(5), 2::INTEGER, 'Approaching Expectations'::TEXT;
  ELSE
    RETURN QUERY SELECT 'BE'::VARCHAR(5), 1::INTEGER, 'Below Expectations'::TEXT;
  END IF;
END;
$$;

-- Function to compute student results for a session
CREATE OR REPLACE FUNCTION public.compute_student_results(p_exam_session_id BIGINT, p_student_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_marks DECIMAL := 0;
  v_total_possible DECIMAL := 0;
  v_total_points INTEGER := 0;
  v_subjects_count INTEGER := 0;
  v_average_points DECIMAL;
  v_overall_grade VARCHAR(5);
  v_class_id BIGINT;
  v_stream_id BIGINT;
BEGIN
  -- Get student class and stream
  SELECT current_class_id, current_stream_id INTO v_class_id, v_stream_id
  FROM public.students WHERE id = p_student_id;
  
  -- Calculate totals from all submitted marks
  SELECT 
    COALESCE(SUM(em.marks), 0),
    COALESCE(SUM(ep.max_marks), 0),
    COALESCE(SUM(em.points), 0),
    COUNT(DISTINCT ep.subject_id)
  INTO v_total_marks, v_total_possible, v_total_points, v_subjects_count
  FROM public.exam_marks em
  JOIN public.exam_papers ep ON ep.id = em.exam_paper_id
  WHERE ep.exam_session_id = p_exam_session_id
    AND em.student_id = p_student_id
    AND em.is_submitted = true
    AND em.is_absent = false;
  
  -- Calculate averages
  IF v_subjects_count > 0 THEN
    v_average_points := v_total_points::DECIMAL / v_subjects_count;
  ELSE
    v_average_points := 0;
  END IF;
  
  -- Determine overall grade
  IF v_average_points >= 3.5 THEN
    v_overall_grade := 'EE';
  ELSIF v_average_points >= 2.5 THEN
    v_overall_grade := 'ME';
  ELSIF v_average_points >= 1.5 THEN
    v_overall_grade := 'AE';
  ELSE
    v_overall_grade := 'BE';
  END IF;
  
  -- Upsert the result
  INSERT INTO public.student_exam_results (
    exam_session_id, student_id, class_id, stream_id,
    total_marks, total_possible, average_percentage,
    total_points, average_points, overall_grade, subjects_count,
    computed_at
  ) VALUES (
    p_exam_session_id, p_student_id, v_class_id, v_stream_id,
    v_total_marks, v_total_possible,
    CASE WHEN v_total_possible > 0 THEN (v_total_marks / v_total_possible) * 100 ELSE 0 END,
    v_total_points, v_average_points, v_overall_grade, v_subjects_count,
    NOW()
  )
  ON CONFLICT (exam_session_id, student_id)
  DO UPDATE SET
    total_marks = EXCLUDED.total_marks,
    total_possible = EXCLUDED.total_possible,
    average_percentage = EXCLUDED.average_percentage,
    total_points = EXCLUDED.total_points,
    average_points = EXCLUDED.average_points,
    overall_grade = EXCLUDED.overall_grade,
    subjects_count = EXCLUDED.subjects_count,
    computed_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_exam_sessions_school ON public.exam_sessions(school_id);
CREATE INDEX idx_exam_sessions_term ON public.exam_sessions(term_id);
CREATE INDEX idx_exam_papers_session ON public.exam_papers(exam_session_id);
CREATE INDEX idx_exam_papers_class ON public.exam_papers(class_id);
CREATE INDEX idx_exam_papers_subject ON public.exam_papers(subject_id);
CREATE INDEX idx_exam_marks_paper ON public.exam_marks(exam_paper_id);
CREATE INDEX idx_exam_marks_student ON public.exam_marks(student_id);
CREATE INDEX idx_student_exam_results_session ON public.student_exam_results(exam_session_id);
CREATE INDEX idx_student_exam_results_student ON public.student_exam_results(student_id);