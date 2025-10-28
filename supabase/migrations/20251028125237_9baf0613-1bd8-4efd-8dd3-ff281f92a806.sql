-- Create attendance table for daily tracking
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id BIGINT REFERENCES public.classes(id) ON DELETE SET NULL,
  stream_id BIGINT REFERENCES public.streams(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'sick', 'left_early')),
  time_in TIME,
  time_out TIME,
  reason TEXT,
  marked_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  term SMALLINT NOT NULL CHECK (term IN (1, 2, 3)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_student ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON public.attendance(class_id);
CREATE INDEX IF NOT EXISTS idx_attendance_stream ON public.attendance(stream_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year_term ON public.attendance(academic_year, term);

-- Enable Row Level Security
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view all attendance records"
  ON public.attendance FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update attendance"
  ON public.attendance FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete attendance"
  ON public.attendance FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendance_updated_at_trigger
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_attendance_updated_at();

-- Create attendance summary view for analytics
CREATE OR REPLACE VIEW public.attendance_summary AS
SELECT 
  s.id AS student_id,
  s.full_name,
  s.current_class_id,
  s.current_stream_id,
  COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS days_present,
  COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS days_absent,
  COUNT(CASE WHEN a.status = 'late' THEN 1 END) AS days_late,
  COUNT(CASE WHEN a.status IN ('excused', 'sick') THEN 1 END) AS days_excused,
  COUNT(a.id) AS total_days,
  ROUND(
    (COUNT(CASE WHEN a.status = 'present' THEN 1 END)::NUMERIC / 
    NULLIF(COUNT(a.id), 0) * 100), 
    2
  ) AS attendance_percentage
FROM public.students s
LEFT JOIN public.attendance a ON a.student_id = s.id
WHERE s.is_active = true
GROUP BY s.id, s.full_name, s.current_class_id, s.current_stream_id;