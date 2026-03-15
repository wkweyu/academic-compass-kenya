-- Phase 2: Formalizing Role Permissions & Subscription Tiers

-- 1. Create a detailed pricing and feature table for reference and enforcement
CREATE TABLE IF NOT EXISTS public.saas_tier_features (
  tier_name TEXT PRIMARY KEY CHECK (tier_name IN ('starter', 'standard', 'enterprise')),
  onboarding_fee DECIMAL(12,2) NOT NULL,
  annual_fee DECIMAL(12,2) NOT NULL,
  max_students INTEGER NOT NULL,
  max_users INTEGER NOT NULL,
  modules JSONB NOT NULL DEFAULT '[]', -- List of enabled modules e.g. ["exams", "attendance"]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed formal pricing (in KES)
INSERT INTO public.saas_tier_features (tier_name, onboarding_fee, annual_fee, max_students, max_users, modules)
VALUES 
(
  'starter', 
  50000.00, 
  30000.00, 
  250, 
  10, 
  '["core", "attendance", "exams", "grading", "subjects", "students"]'
),
(
  'standard', 
  75000.00, 
  50000.00, 
  750, 
  30, 
  '["core", "attendance", "exams", "grading", "subjects", "students", "fees", "accounting", "inventory", "procurement"]'
),
(
  'enterprise', 
  100000.00, 
  100000.00, 
  1000000, 
  1000000, 
  '["core", "attendance", "exams", "grading", "subjects", "students", "fees", "accounting", "inventory", "procurement", "transport", "fleet", "iga", "staff_management", "report_builder"]'
)
ON CONFLICT (tier_name) DO UPDATE SET 
  onboarding_fee = EXCLUDED.onboarding_fee,
  annual_fee = EXCLUDED.annual_fee,
  max_students = EXCLUDED.max_students,
  max_users = EXCLUDED.max_users,
  modules = EXCLUDED.modules;

-- 2. Enhanced Role Logic for "Marketers/Account Managers"
-- They manage their own portfolio: schools, subscriptions, status, but can only see their own.
-- Marketers specifically handle the onboarding and documentation for their portfolio.

CREATE OR REPLACE FUNCTION public.get_platform_access_profile()
RETURNS TABLE(
  user_id UUID,
  roles TEXT[],
  primary_role TEXT,
  scope TEXT,
  can_view_dashboard BOOLEAN,
  can_onboard_schools BOOLEAN,
  can_manage_school_status BOOLEAN,
  can_manage_subscriptions BOOLEAN,
  can_manage_portfolios BOOLEAN,
  can_edit_school_details BOOLEAN,
  can_resend_admin_access BOOLEAN,
  can_view_audit_logs BOOLEAN,
  accessible_school_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_roles TEXT[] := ARRAY[]::TEXT[];
  resolved_primary_role TEXT := 'none';
  resolved_scope TEXT := 'none';
BEGIN
  SELECT COALESCE(array_agg(ur.role::TEXT ORDER BY ur.role::TEXT), ARRAY[]::TEXT[])
  INTO current_roles
  FROM public.user_roles ur
  WHERE ur.user_id = current_user_id
    AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer');

  IF 'platform_admin' = ANY(current_roles) THEN
    resolved_primary_role := 'platform_admin';
    resolved_scope := 'global';
  ELSIF 'support' = ANY(current_roles) THEN
    resolved_primary_role := 'support';
    resolved_scope := 'global';
  ELSIF 'account_manager' = ANY(current_roles) THEN
    resolved_primary_role := 'account_manager';
    resolved_scope := 'portfolio';
  ELSIF 'marketer' = ANY(current_roles) THEN
    resolved_primary_role := 'marketer';
    resolved_scope := 'portfolio';
  END IF;

  RETURN QUERY
  SELECT
    current_user_id,
    current_roles,
    resolved_primary_role,
    resolved_scope,
    (resolved_primary_role <> 'none'),
    -- can_onboard_schools: Admin, Manager, and Marketer can onboard to their portfolio
    (resolved_primary_role IN ('platform_admin', 'account_manager', 'marketer')),
    -- can_manage_school_status: Admin and Portfolio Owners can toggle status
    (resolved_primary_role IN ('platform_admin', 'account_manager', 'marketer')),
    -- can_manage_subscriptions: Admin and Portfolio Owners can upgrade/downgrade
    (resolved_primary_role IN ('platform_admin', 'account_manager', 'marketer')),
    -- can_manage_portfolios: ONLY Super Admin can assign portfolio ownership
    (resolved_primary_role = 'platform_admin'),
    -- basic edit: Everyone can edit school details for their scope
    (resolved_primary_role <> 'none'),
    -- resend dev tools: Support, Manager, and admin
    (resolved_primary_role IN ('platform_admin', 'support', 'account_manager', 'marketer')),
    -- audit logs: Admin sees all, Manager/Marketer see their portfolio's logs
    (resolved_primary_role <> 'none'),
    (SELECT COUNT(*)::BIGINT FROM public.get_accessible_platform_school_ids(current_user_id));
END;
$$;

-- 3. Validation: Prevent non-admins from assigning portfolios to themeselves or others
CREATE OR REPLACE FUNCTION public.validate_portfolio_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Only platform administrators can assign or change portfolio ownership.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_portfolio_assignment ON public.school_portfolio_assignments;
CREATE TRIGGER tr_validate_portfolio_assignment
  BEFORE INSERT OR UPDATE ON public.school_portfolio_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_portfolio_assignment();

-- 4. Subscription Enforcement View for Application
CREATE OR REPLACE VIEW public.vw_school_tier_enforcement AS
SELECT 
  s.id as school_id,
  s.name,
  s.subscription_plan as tier,
  stf.max_students,
  stf.max_users,
  stf.modules,
  (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.id AND st.is_active = TRUE) as current_students,
  (SELECT COUNT(*) FROM public.users u WHERE u.school_id = s.id AND u.is_active = TRUE) as current_users
FROM public.schools_school s
JOIN public.saas_tier_features stf ON s.subscription_plan = stf.tier_name;
