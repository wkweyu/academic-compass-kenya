-- Fix the security definer view by setting security_invoker
ALTER VIEW exam_session_class_progress SET (security_invoker = on);