-- Fix security issues with attendance_summary view
DROP VIEW IF EXISTS public.attendance_summary;

CREATE VIEW public.attendance_summary 
WITH (security_invoker = true) AS
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

-- Fix update function search path
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;