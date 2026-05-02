-- Add examinable and compulsory flags to class_subjects
ALTER TABLE public.class_subjects 
ADD COLUMN IF NOT EXISTS is_examinable BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_compulsory BOOLEAN NOT NULL DEFAULT true;

-- Create subject groups table for elective groupings (e.g., "Choose 2 from Art, Music, French")
CREATE TABLE IF NOT EXISTS public.subject_groups (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT '',
  class_id BIGINT NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  min_subjects INTEGER NOT NULL DEFAULT 1,
  max_subjects INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link class_subjects to subject groups (for electives)
ALTER TABLE public.class_subjects 
ADD COLUMN IF NOT EXISTS subject_group_id BIGINT REFERENCES public.subject_groups(id) ON DELETE SET NULL;

-- Student subject allocations - tracks which students are enrolled in which subjects
CREATE TABLE IF NOT EXISTS public.student_subject_allocations (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_subject_id BIGINT NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  term SMALLINT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, class_subject_id, academic_year, term)
);

-- Enable RLS on new tables
ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_subject_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for subject_groups
CREATE POLICY "Users can view subject groups from their school"
ON public.subject_groups FOR SELECT TO authenticated
USING (school_id = get_user_school_id());

CREATE POLICY "Users can create subject groups for their school"
ON public.subject_groups FOR INSERT TO authenticated
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can update subject groups from their school"
ON public.subject_groups FOR UPDATE TO authenticated
USING (school_id = get_user_school_id())
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can delete subject groups from their school"
ON public.subject_groups FOR DELETE TO authenticated
USING (school_id = get_user_school_id());

-- RLS policies for student_subject_allocations
CREATE POLICY "Users can view student subject allocations from their school"
ON public.student_subject_allocations FOR SELECT TO authenticated
USING (school_id = get_user_school_id());

CREATE POLICY "Users can create student subject allocations for their school"
ON public.student_subject_allocations FOR INSERT TO authenticated
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can update student subject allocations from their school"
ON public.student_subject_allocations FOR UPDATE TO authenticated
USING (school_id = get_user_school_id())
WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can delete student subject allocations from their school"
ON public.student_subject_allocations FOR DELETE TO authenticated
USING (school_id = get_user_school_id());

-- Triggers for updated_at
CREATE TRIGGER update_subject_groups_updated_at
BEFORE UPDATE ON public.subject_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_subject_tables_updated_at();

CREATE TRIGGER update_student_subject_allocations_updated_at
BEFORE UPDATE ON public.student_subject_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_subject_tables_updated_at();