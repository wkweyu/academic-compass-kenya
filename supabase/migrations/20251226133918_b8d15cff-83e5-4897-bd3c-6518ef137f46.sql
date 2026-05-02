-- Drop the broken view and recreate with correct column
DROP VIEW IF EXISTS exam_session_class_progress;

CREATE OR REPLACE VIEW exam_session_class_progress AS
SELECT 
  esc.exam_session_id,
  esc.class_id,
  c.name as class_name,
  COUNT(DISTINCT ep.id) as total_papers,
  COUNT(DISTINCT CASE WHEN ep.status = 'completed' THEN ep.id END) as completed_papers,
  COALESCE(
    ROUND(
      (COUNT(DISTINCT CASE WHEN ep.status = 'completed' THEN ep.id END)::numeric / 
       NULLIF(COUNT(DISTINCT ep.id), 0)::numeric) * 100, 
      1
    ), 
    0
  ) as completion_percentage,
  (SELECT COUNT(*) FROM students s WHERE s.current_class_id = esc.class_id AND s.is_active = true) as total_students
FROM exam_session_classes esc
JOIN classes c ON c.id = esc.class_id
LEFT JOIN exam_papers ep ON ep.exam_session_id = esc.exam_session_id AND ep.class_id = esc.class_id
GROUP BY esc.exam_session_id, esc.class_id, c.name;