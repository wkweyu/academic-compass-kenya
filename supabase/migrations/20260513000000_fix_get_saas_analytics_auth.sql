-- Fix get_saas_analytics to use can_view_platform_console() instead of has_role('platform_admin')
-- This allows account_managers, support, and marketers to also view analytics for their accessible schools.

CREATE OR REPLACE FUNCTION public.get_saas_analytics()
RETURNS TABLE(
  total_schools BIGINT, active_schools BIGINT, inactive_schools BIGINT,
  total_students BIGINT, total_teachers BIGINT,
  schools_on_starter BIGINT, schools_on_standard BIGINT, schools_on_enterprise BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH accessible_schools AS (
    SELECT s.id, s.active,
           COALESCE(s.subscription_plan, 'starter') AS subscription_plan,
           COALESCE(s.subscription_status, 'active') AS subscription_status
    FROM public.schools_school s
    WHERE EXISTS (
      SELECT 1
      FROM public.get_accessible_platform_school_ids(auth.uid()) accessible
      WHERE accessible.school_id = s.id
    )
  )
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE active = TRUE AND subscription_status IN ('active', 'trial'))::BIGINT,
    COUNT(*) FILTER (WHERE active = FALSE OR subscription_status NOT IN ('active', 'trial'))::BIGINT,
    (SELECT COUNT(*)::BIGINT FROM public.students st
     WHERE st.is_active = TRUE AND st.school_id IN (SELECT id FROM accessible_schools)),
    (SELECT COUNT(*)::BIGINT FROM public.teachers t
     WHERE t.is_active = TRUE AND t.school_id IN (SELECT id FROM accessible_schools)),
    COUNT(*) FILTER (WHERE subscription_plan = 'starter')::BIGINT,
    COUNT(*) FILTER (WHERE subscription_plan = 'standard')::BIGINT,
    COUNT(*) FILTER (WHERE subscription_plan = 'enterprise')::BIGINT
  FROM accessible_schools;
END;
$$;

-- Ensure platform_admin role check on saas_communications works for all platform roles
-- Fix RLS on saas_communications to allow account_manager and support reads

DROP POLICY IF EXISTS "Platform staff can view all communications" ON public.saas_communications;
CREATE POLICY "Platform staff can view all communications"
  ON public.saas_communications FOR SELECT TO authenticated
  USING (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Platform staff can insert communications" ON public.saas_communications;
CREATE POLICY "Platform staff can insert communications"
  ON public.saas_communications FOR INSERT TO authenticated
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Platform staff can update communications" ON public.saas_communications;
CREATE POLICY "Platform staff can update communications"
  ON public.saas_communications FOR UPDATE TO authenticated
  USING (public.can_view_platform_console(auth.uid()));
