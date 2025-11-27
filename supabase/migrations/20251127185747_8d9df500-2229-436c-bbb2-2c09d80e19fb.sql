-- Create function to generate employee numbers
CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year TEXT;
  counter INTEGER;
  emp_num TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_no FROM LENGTH(year) + 4) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.teachers
  WHERE employee_no LIKE 'EMP' || year || '%';
  
  -- Format as EMP2025001, EMP2025002, etc.
  emp_num := 'EMP' || year || LPAD(counter::TEXT, 3, '0');
  
  RETURN emp_num;
END;
$$;

-- Create trigger function to auto-generate employee number on insert
CREATE OR REPLACE FUNCTION public.set_employee_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.employee_no IS NULL OR NEW.employee_no = '' THEN
    NEW.employee_no := generate_employee_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_employee_number ON public.teachers;

-- Create trigger to auto-generate employee number
CREATE TRIGGER trigger_set_employee_number
  BEFORE INSERT ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employee_number();

-- Add term column to teacher_subject_assignments if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teacher_subject_assignments' AND column_name = 'term') THEN
    ALTER TABLE public.teacher_subject_assignments ADD COLUMN term SMALLINT CHECK (term IN (1, 2, 3));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teacher_subject_assignments' AND column_name = 'is_class_teacher') THEN
    ALTER TABLE public.teacher_subject_assignments ADD COLUMN is_class_teacher BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'teacher_subject_assignments' AND column_name = 'updated_at') THEN
    ALTER TABLE public.teacher_subject_assignments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Create staff_attendance table
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  status VARCHAR(50) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day', 'On Leave')),
  leave_type VARCHAR(50) CHECK (leave_type IN ('Sick', 'Annual', 'Maternity', 'Study', 'Emergency', 'Other')),
  notes TEXT,
  approved_by BIGINT REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- Enable RLS on staff_attendance
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_attendance
CREATE POLICY "Users can view attendance from their school"
  ON public.staff_attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.teachers t 
    WHERE t.id = staff_attendance.staff_id 
    AND t.school_id = public.get_user_school_id()
  ));

CREATE POLICY "Users can create attendance for their school"
  ON public.staff_attendance FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.teachers t 
    WHERE t.id = staff_attendance.staff_id 
    AND t.school_id = public.get_user_school_id()
  ));

CREATE POLICY "Users can update attendance from their school"
  ON public.staff_attendance FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.teachers t 
    WHERE t.id = staff_attendance.staff_id 
    AND t.school_id = public.get_user_school_id()
  ));

CREATE POLICY "Users can delete attendance from their school"
  ON public.staff_attendance FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.teachers t 
    WHERE t.id = staff_attendance.staff_id 
    AND t.school_id = public.get_user_school_id()
  ));

-- Add trigger for updated_at on staff_attendance
DROP TRIGGER IF EXISTS update_staff_attendance_updated_at ON public.staff_attendance;
CREATE TRIGGER update_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on teacher_subject_assignments if not exists
DROP TRIGGER IF EXISTS update_teacher_subject_assignments_updated_at ON public.teacher_subject_assignments;
CREATE TRIGGER update_teacher_subject_assignments_updated_at
  BEFORE UPDATE ON public.teacher_subject_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff ON public.staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance(date);