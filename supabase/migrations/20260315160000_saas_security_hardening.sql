-- Final Security Sweep for SaaS Platform Console

-- 1. Ensure only users with platform roles can see the console-specific views
-- This hardens existing policies to prevent lateral movement

-- Policy for saas_invoices
DROP POLICY IF EXISTS "Platform console can manage all invoices" ON public.saas_invoices;
CREATE POLICY "Platform console can manage all invoices" ON public.saas_invoices
  FOR ALL TO authenticated 
  USING (
    public.can_view_platform_console(auth.uid()) AND (
      public.is_platform_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.schools_school s
        WHERE s.id = public.saas_invoices.school_id
        AND (s.portfolio_owner_user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
      )
    )
  );

-- Policy for saas_communications
DROP POLICY IF EXISTS "Platform console can view communications" ON public.saas_communications;
CREATE POLICY "Platform console can view communications" ON public.saas_communications
  FOR SELECT TO authenticated 
  USING (
    public.can_view_platform_console(auth.uid()) AND (
      public.is_platform_admin(auth.uid()) OR 
      EXISTS (
        SELECT 1 FROM public.schools_school s
        WHERE s.id = public.saas_communications.school_id
        AND (s.portfolio_owner_user_id = auth.uid() OR public.is_platform_admin(auth.uid()))
      )
    )
  );

-- Policy for saas_audit_logs (SaaS console specific audit)
DROP POLICY IF EXISTS "Platform console can view audit logs" ON public.saas_audit_logs;
CREATE POLICY "Platform console can view audit logs" ON public.saas_audit_logs
  FOR SELECT TO authenticated 
  USING (
    public.can_view_platform_console(auth.uid()) AND (
      public.is_platform_admin(auth.uid()) OR 
      (school_id IN (SELECT id FROM public.schools_school WHERE portfolio_owner_user_id = auth.uid()))
    )
  );

-- 2. Prevent non-admins from changing their own roles or permissions
ALTER TABLE public.platform_console_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Individual roles are viewable by self" ON public.platform_console_roles;
CREATE POLICY "Individual roles are viewable by self" ON public.platform_console_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.platform_console_roles;
CREATE POLICY "Admins can manage roles" ON public.platform_console_roles
  FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid()));

-- 3. Secure RPCs by ensuring internally they still check for proper scope
CREATE OR REPLACE FUNCTION public.get_all_schools_v2()
RETURNS SETOF public.schools_school
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- If admin, show everything. If not, show only portfolio schools.
  IF public.is_platform_admin(auth.uid()) THEN
    RETURN QUERY SELECT * FROM public.schools_school ORDER BY name ASC;
  ELSE
    RETURN QUERY SELECT * FROM public.schools_school WHERE portfolio_owner_user_id = auth.uid() ORDER BY name ASC;
  END IF;
END;
$$;

-- 4. Audit Trail for Security: Log all unauthorized access attempts
CREATE OR REPLACE FUNCTION public.log_unauthorized_access()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.saas_audit_logs (action, module, details)
  VALUES ('UNAUTHORIZED_ACCESS_ATTEMPT', 'security', jsonb_build_object('user_id', auth.uid(), 'timestamp', NOW()));
END;
$$;
