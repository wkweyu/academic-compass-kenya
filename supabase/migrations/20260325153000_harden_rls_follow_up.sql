-- Follow-up hardening for RLS and invoker views after audit.

-- 1. Canonical helper for SQL-side platform user checks.
CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.user_has_any_role(
    _user_id,
    ARRAY['platform_admin', 'support', 'account_manager', 'marketer']::public.app_role[]
  )
$$;

-- 2. Split write permissions by domain.
CREATE OR REPLACE FUNCTION public.can_manage_school_crm_record(p_school_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    (p_school_id = public.get_user_school_id() AND public.is_admin(auth.uid()))
    OR public.can_access_platform_school(auth.uid(), p_school_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school_operational_record(p_school_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    (p_school_id = public.get_user_school_id() AND public.is_admin(auth.uid()))
    OR public.user_has_any_role(auth.uid(), ARRAY['platform_admin', 'support']::public.app_role[])
  )
$$;

-- 3. Platform users need scoped visibility to schools for invoker views.
DROP POLICY IF EXISTS "Platform users can view accessible schools" ON public.schools_school;
CREATE POLICY "Platform users can view accessible schools"
  ON public.schools_school FOR SELECT TO authenticated
  USING (public.can_access_platform_school(auth.uid(), id));

-- 4. Authorized counters used by invoker views. These bypass base-table RLS only
-- after enforcing the same school/platform authorization at the function boundary.
CREATE OR REPLACE FUNCTION public.get_school_active_student_count(p_school_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_school_scoped_record(p_school_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM public.students st
    WHERE st.school_id = p_school_id
      AND COALESCE(st.is_active, TRUE) = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_active_user_count(p_school_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_read_school_scoped_record(p_school_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT COUNT(*)::BIGINT
    FROM public.users u
    WHERE u.school_id = p_school_id
      AND COALESCE(u.is_active, TRUE) = TRUE
  );
END;
$$;

-- 5. Rebuild tier enforcement view to avoid direct reads from protected base tables.
CREATE OR REPLACE VIEW public.vw_school_tier_enforcement AS
SELECT
  s.id AS school_id,
  s.name,
  s.subscription_plan AS tier,
  stf.max_students,
  stf.max_users,
  stf.modules,
  public.get_school_active_student_count(s.id) AS current_students,
  public.get_school_active_user_count(s.id) AS current_users
FROM public.schools_school s
JOIN public.saas_tier_features stf ON s.subscription_plan = stf.tier_name
WHERE public.can_read_school_scoped_record(s.id);

ALTER VIEW public.vw_school_tier_enforcement SET (security_invoker = true);

-- 6. Attendance tables: keep same-school admin access for configuration/logs,
-- but restrict direct device secret reads to platform users only.
DROP POLICY IF EXISTS "Attendance admins can manage configuration" ON public.attendance_configuration;
CREATE POLICY "Attendance admins can manage configuration" ON public.attendance_configuration
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can view devices" ON public.attendance_biometric_device;
CREATE POLICY "Platform users can view biometric devices" ON public.attendance_biometric_device
  FOR SELECT TO authenticated
  USING (public.is_platform_user(auth.uid()) AND public.can_access_platform_school(auth.uid(), school_id));

DROP POLICY IF EXISTS "Attendance admins can manage devices" ON public.attendance_biometric_device;
CREATE POLICY "Attendance admins can manage devices" ON public.attendance_biometric_device
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage biometric logs" ON public.attendance_biometric_log;
CREATE POLICY "Attendance admins can manage biometric logs" ON public.attendance_biometric_log
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage SMS logs" ON public.attendance_sms_log;
CREATE POLICY "Attendance admins can manage SMS logs" ON public.attendance_sms_log
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

-- 7. CRM/onboarding tables keep portfolio-based cross-tenant workflows.
DROP POLICY IF EXISTS "Admins can manage onboarding progress for accessible schools" ON public.schools_onboardingprogress;
CREATE POLICY "Admins can manage onboarding progress for accessible schools" ON public.schools_onboardingprogress
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage school tasks for accessible schools" ON public.schools_schooltask;
CREATE POLICY "Admins can manage school tasks for accessible schools" ON public.schools_schooltask
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage activity logs for accessible schools" ON public.schools_activitylog;
CREATE POLICY "Admins can manage activity logs for accessible schools" ON public.schools_activitylog
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage follow ups for accessible schools" ON public.schools_followup;
CREATE POLICY "Admins can manage follow ups for accessible schools" ON public.schools_followup
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage leads for accessible schools" ON public.schools_lead;
CREATE POLICY "Admins can manage leads for accessible schools" ON public.schools_lead
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot;
CREATE POLICY "Admins can manage health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage upsell opportunities for accessible schools" ON public.schools_upsellopportunity;
CREATE POLICY "Admins can manage upsell opportunities for accessible schools" ON public.schools_upsellopportunity
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage communication logs for accessible schools" ON public.schools_communicationlog;
CREATE POLICY "Admins can manage communication logs for accessible schools" ON public.schools_communicationlog
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

DROP POLICY IF EXISTS "Admins can manage notification records for accessible schools" ON public.schools_notificationrecord;
CREATE POLICY "Admins can manage notification records for accessible schools" ON public.schools_notificationrecord
  FOR ALL TO authenticated
  USING (public.can_manage_school_crm_record(school_id))
  WITH CHECK (public.can_manage_school_crm_record(school_id));

-- 8. IGA tables are operational, not portfolio CRM.
DROP POLICY IF EXISTS "Admins can manage IGA activities for accessible schools" ON public.iga_activity;
CREATE POLICY "Admins can manage IGA activities for accessible schools" ON public.iga_activity
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA products for accessible schools" ON public.iga_product;
CREATE POLICY "Admins can manage IGA products for accessible schools" ON public.iga_product
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA inventory stock for accessible schools" ON public.iga_inventorystock;
CREATE POLICY "Admins can manage IGA inventory stock for accessible schools" ON public.iga_inventorystock
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA inventory movements for accessible schools" ON public.iga_inventorymovement;
CREATE POLICY "Admins can manage IGA inventory movements for accessible schools" ON public.iga_inventorymovement
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA production records for accessible schools" ON public.iga_productionrecord;
CREATE POLICY "Admins can manage IGA production records for accessible schools" ON public.iga_productionrecord
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA produce sales for accessible schools" ON public.iga_producesale;
CREATE POLICY "Admins can manage IGA produce sales for accessible schools" ON public.iga_producesale
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA activity expenses for accessible schools" ON public.iga_activityexpense;
CREATE POLICY "Admins can manage IGA activity expenses for accessible schools" ON public.iga_activityexpense
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA activity budgets for accessible schools" ON public.iga_activitybudget;
CREATE POLICY "Admins can manage IGA activity budgets for accessible schools" ON public.iga_activitybudget
  FOR ALL TO authenticated
  USING (public.can_manage_school_operational_record(school_id))
  WITH CHECK (public.can_manage_school_operational_record(school_id));