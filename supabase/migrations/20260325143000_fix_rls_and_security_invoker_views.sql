-- Fix security linter findings from rsl_issue.MD

-- 1. Ensure flagged views run with invoker permissions instead of owner permissions.
ALTER VIEW public.billing_account_snapshot_v1 SET (security_invoker = true);
ALTER VIEW public.vw_school_tier_enforcement SET (security_invoker = true);

-- 2. Shared helpers for school-scoped RLS policies.
CREATE OR REPLACE FUNCTION public.can_read_school_scoped_record(p_school_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    p_school_id = public.get_user_school_id()
    OR public.can_access_platform_school(auth.uid(), p_school_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_school_scoped_record(p_school_id BIGINT)
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

-- 3. Attendance tables: restrict direct access to school admins and platform staff.
ALTER TABLE public.attendance_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_biometric_device ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_biometric_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sms_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendance admins can view configuration" ON public.attendance_configuration;
CREATE POLICY "Attendance admins can view configuration" ON public.attendance_configuration
  FOR SELECT TO authenticated
  USING (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage configuration" ON public.attendance_configuration;
CREATE POLICY "Attendance admins can manage configuration" ON public.attendance_configuration
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can view devices" ON public.attendance_biometric_device;
CREATE POLICY "Attendance admins can view devices" ON public.attendance_biometric_device
  FOR SELECT TO authenticated
  USING (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage devices" ON public.attendance_biometric_device;
CREATE POLICY "Attendance admins can manage devices" ON public.attendance_biometric_device
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can view biometric logs" ON public.attendance_biometric_log;
CREATE POLICY "Attendance admins can view biometric logs" ON public.attendance_biometric_log
  FOR SELECT TO authenticated
  USING (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage biometric logs" ON public.attendance_biometric_log;
CREATE POLICY "Attendance admins can manage biometric logs" ON public.attendance_biometric_log
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can view SMS logs" ON public.attendance_sms_log;
CREATE POLICY "Attendance admins can view SMS logs" ON public.attendance_sms_log
  FOR SELECT TO authenticated
  USING (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Attendance admins can manage SMS logs" ON public.attendance_sms_log;
CREATE POLICY "Attendance admins can manage SMS logs" ON public.attendance_sms_log
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

-- 4. School-scoped CRM/onboarding tables.
ALTER TABLE public.schools_onboardingprogress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_schooltask ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_activitylog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_followup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_lead ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_schoolhealthsnapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_upsellopportunity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_communicationlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools_notificationrecord ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view onboarding progress for accessible schools" ON public.schools_onboardingprogress;
CREATE POLICY "Users can view onboarding progress for accessible schools" ON public.schools_onboardingprogress
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage onboarding progress for accessible schools" ON public.schools_onboardingprogress;
CREATE POLICY "Admins can manage onboarding progress for accessible schools" ON public.schools_onboardingprogress
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view school tasks for accessible schools" ON public.schools_schooltask;
CREATE POLICY "Users can view school tasks for accessible schools" ON public.schools_schooltask
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage school tasks for accessible schools" ON public.schools_schooltask;
CREATE POLICY "Admins can manage school tasks for accessible schools" ON public.schools_schooltask
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view activity logs for accessible schools" ON public.schools_activitylog;
CREATE POLICY "Users can view activity logs for accessible schools" ON public.schools_activitylog
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage activity logs for accessible schools" ON public.schools_activitylog;
CREATE POLICY "Admins can manage activity logs for accessible schools" ON public.schools_activitylog
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view follow ups for accessible schools" ON public.schools_followup;
CREATE POLICY "Users can view follow ups for accessible schools" ON public.schools_followup
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage follow ups for accessible schools" ON public.schools_followup;
CREATE POLICY "Admins can manage follow ups for accessible schools" ON public.schools_followup
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view leads for accessible schools" ON public.schools_lead;
CREATE POLICY "Users can view leads for accessible schools" ON public.schools_lead
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage leads for accessible schools" ON public.schools_lead;
CREATE POLICY "Admins can manage leads for accessible schools" ON public.schools_lead
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot;
CREATE POLICY "Users can view health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot;
CREATE POLICY "Admins can manage health snapshots for accessible schools" ON public.schools_schoolhealthsnapshot
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view upsell opportunities for accessible schools" ON public.schools_upsellopportunity;
CREATE POLICY "Users can view upsell opportunities for accessible schools" ON public.schools_upsellopportunity
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage upsell opportunities for accessible schools" ON public.schools_upsellopportunity;
CREATE POLICY "Admins can manage upsell opportunities for accessible schools" ON public.schools_upsellopportunity
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view communication logs for accessible schools" ON public.schools_communicationlog;
CREATE POLICY "Users can view communication logs for accessible schools" ON public.schools_communicationlog
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage communication logs for accessible schools" ON public.schools_communicationlog;
CREATE POLICY "Admins can manage communication logs for accessible schools" ON public.schools_communicationlog
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view notification records for accessible schools" ON public.schools_notificationrecord;
CREATE POLICY "Users can view notification records for accessible schools" ON public.schools_notificationrecord
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage notification records for accessible schools" ON public.schools_notificationrecord;
CREATE POLICY "Admins can manage notification records for accessible schools" ON public.schools_notificationrecord
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

-- 5. Notification templates are global, but should only be visible to staff roles that use them.
ALTER TABLE public.schools_notificationtemplate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view notification templates" ON public.schools_notificationtemplate;
CREATE POLICY "Staff can view notification templates" ON public.schools_notificationtemplate
  FOR SELECT TO authenticated
  USING (public.can_view_platform_console(auth.uid()) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins can manage notification templates" ON public.schools_notificationtemplate;
CREATE POLICY "Platform admins can manage notification templates" ON public.schools_notificationtemplate
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- 6. IGA tables: school-scoped read access, admin/platform management.
ALTER TABLE public.iga_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_inventorystock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_inventorymovement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_productionrecord ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_producesale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_activityexpense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iga_activitybudget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view IGA activities for accessible schools" ON public.iga_activity;
CREATE POLICY "Users can view IGA activities for accessible schools" ON public.iga_activity
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA activities for accessible schools" ON public.iga_activity;
CREATE POLICY "Admins can manage IGA activities for accessible schools" ON public.iga_activity
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA products for accessible schools" ON public.iga_product;
CREATE POLICY "Users can view IGA products for accessible schools" ON public.iga_product
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA products for accessible schools" ON public.iga_product;
CREATE POLICY "Admins can manage IGA products for accessible schools" ON public.iga_product
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA inventory stock for accessible schools" ON public.iga_inventorystock;
CREATE POLICY "Users can view IGA inventory stock for accessible schools" ON public.iga_inventorystock
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA inventory stock for accessible schools" ON public.iga_inventorystock;
CREATE POLICY "Admins can manage IGA inventory stock for accessible schools" ON public.iga_inventorystock
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA inventory movements for accessible schools" ON public.iga_inventorymovement;
CREATE POLICY "Users can view IGA inventory movements for accessible schools" ON public.iga_inventorymovement
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA inventory movements for accessible schools" ON public.iga_inventorymovement;
CREATE POLICY "Admins can manage IGA inventory movements for accessible schools" ON public.iga_inventorymovement
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA production records for accessible schools" ON public.iga_productionrecord;
CREATE POLICY "Users can view IGA production records for accessible schools" ON public.iga_productionrecord
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA production records for accessible schools" ON public.iga_productionrecord;
CREATE POLICY "Admins can manage IGA production records for accessible schools" ON public.iga_productionrecord
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA produce sales for accessible schools" ON public.iga_producesale;
CREATE POLICY "Users can view IGA produce sales for accessible schools" ON public.iga_producesale
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA produce sales for accessible schools" ON public.iga_producesale;
CREATE POLICY "Admins can manage IGA produce sales for accessible schools" ON public.iga_producesale
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA activity expenses for accessible schools" ON public.iga_activityexpense;
CREATE POLICY "Users can view IGA activity expenses for accessible schools" ON public.iga_activityexpense
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA activity expenses for accessible schools" ON public.iga_activityexpense;
CREATE POLICY "Admins can manage IGA activity expenses for accessible schools" ON public.iga_activityexpense
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Users can view IGA activity budgets for accessible schools" ON public.iga_activitybudget;
CREATE POLICY "Users can view IGA activity budgets for accessible schools" ON public.iga_activitybudget
  FOR SELECT TO authenticated
  USING (public.can_read_school_scoped_record(school_id));

DROP POLICY IF EXISTS "Admins can manage IGA activity budgets for accessible schools" ON public.iga_activitybudget;
CREATE POLICY "Admins can manage IGA activity budgets for accessible schools" ON public.iga_activitybudget
  FOR ALL TO authenticated
  USING (public.can_manage_school_scoped_record(school_id))
  WITH CHECK (public.can_manage_school_scoped_record(school_id));

-- 7. Tier features are global reference data.
ALTER TABLE public.saas_tier_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tier features" ON public.saas_tier_features;
CREATE POLICY "Authenticated users can view tier features" ON public.saas_tier_features
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Platform admins can manage tier features" ON public.saas_tier_features;
CREATE POLICY "Platform admins can manage tier features" ON public.saas_tier_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));