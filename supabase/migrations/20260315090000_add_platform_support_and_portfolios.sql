ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'account_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';

CREATE TABLE IF NOT EXISTS public.school_portfolio_assignments (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL UNIQUE REFERENCES public.schools_school(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_portfolio_owner_user_id
  ON public.school_portfolio_assignments (owner_user_id);

ALTER TABLE public.school_portfolio_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Portfolio owners can view their assignments" ON public.school_portfolio_assignments;
CREATE POLICY "Portfolio owners can view their assignments"
  ON public.school_portfolio_assignments FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins can manage school portfolios" ON public.school_portfolio_assignments;
CREATE POLICY "Platform admins can manage school portfolios"
  ON public.school_portfolio_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_platform_console(_user_id uuid)
RETURNS boolean
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

CREATE OR REPLACE FUNCTION public.get_accessible_platform_school_ids(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(school_id BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.user_has_any_role(_user_id, ARRAY['platform_admin', 'support']::public.app_role[]) THEN
    RETURN QUERY
    SELECT s.id
    FROM public.schools_school s;
    RETURN;
  END IF;

  IF public.user_has_any_role(_user_id, ARRAY['account_manager', 'marketer']::public.app_role[]) THEN
    RETURN QUERY
    SELECT spa.school_id
    FROM public.school_portfolio_assignments spa
    WHERE spa.owner_user_id = _user_id;
    RETURN;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_platform_school(_user_id uuid, p_school_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_accessible_platform_school_ids(_user_id) accessible
    WHERE accessible.school_id = p_school_id
  )
$$;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  current_roles TEXT[] := ARRAY[]::TEXT[];
  resolved_primary_role TEXT := 'none';
  resolved_scope TEXT := 'none';
  dashboard_access BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(array_agg(ur.role::TEXT ORDER BY ur.role::TEXT), ARRAY[]::TEXT[])
  INTO current_roles
  FROM public.user_roles ur
  WHERE ur.user_id = current_user_id
    AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer');

  dashboard_access := public.can_view_platform_console(current_user_id);

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
    dashboard_access,
    ('platform_admin' = ANY(current_roles) OR 'account_manager' = ANY(current_roles) OR 'marketer' = ANY(current_roles)),
    ('platform_admin' = ANY(current_roles)),
    ('platform_admin' = ANY(current_roles)),
    ('platform_admin' = ANY(current_roles)),
    ('platform_admin' = ANY(current_roles) OR 'support' = ANY(current_roles) OR 'account_manager' = ANY(current_roles) OR 'marketer' = ANY(current_roles)),
    ('platform_admin' = ANY(current_roles) OR 'support' = ANY(current_roles) OR 'account_manager' = ANY(current_roles) OR 'marketer' = ANY(current_roles)),
    dashboard_access,
    (SELECT COUNT(*)::BIGINT FROM public.get_accessible_platform_school_ids(current_user_id));
END;
$$;

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
    SELECT s.id, s.active, COALESCE(s.subscription_plan, 'starter') AS subscription_plan, COALESCE(s.subscription_status, 'active') AS subscription_status
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
    (SELECT COUNT(*)::BIGINT FROM public.students st WHERE st.is_active = TRUE AND st.school_id IN (SELECT id FROM accessible_schools)),
    (SELECT COUNT(*)::BIGINT FROM public.teachers t WHERE t.is_active = TRUE AND t.school_id IN (SELECT id FROM accessible_schools)),
    COUNT(*) FILTER (WHERE subscription_plan = 'starter')::BIGINT,
    COUNT(*) FILTER (WHERE subscription_plan = 'standard')::BIGINT,
    COUNT(*) FILTER (WHERE subscription_plan = 'enterprise')::BIGINT
  FROM accessible_schools;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_schools()
RETURNS TABLE(
  id BIGINT, name TEXT, code TEXT, email TEXT, phone TEXT,
  city TEXT, country TEXT, subscription_plan TEXT, subscription_status TEXT,
  subscription_end TIMESTAMPTZ, active BOOLEAN, created_at TIMESTAMPTZ,
  student_count BIGINT, teacher_count BIGINT,
  portfolio_owner_user_id UUID, portfolio_owner_name TEXT,
  portfolio_owner_email TEXT, portfolio_owner_role TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name::TEXT,
    s.code::TEXT,
    s.email::TEXT,
    s.phone::TEXT,
    COALESCE(s.city, '')::TEXT,
    COALESCE(s.country, 'Kenya')::TEXT,
    COALESCE(s.subscription_plan, 'starter')::TEXT,
    COALESCE(s.subscription_status, 'active')::TEXT,
    s.subscription_end,
    s.active,
    s.created_at,
    (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.id AND st.is_active = TRUE)::BIGINT,
    (SELECT COUNT(*) FROM public.teachers t WHERE t.school_id = s.id AND t.is_active = TRUE)::BIGINT,
    spa.owner_user_id,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unassigned')::TEXT,
    COALESCE(au.email, '')::TEXT,
    CASE
      WHEN public.has_role(spa.owner_user_id, 'account_manager') THEN 'account_manager'
      WHEN public.has_role(spa.owner_user_id, 'marketer') THEN 'marketer'
      ELSE ''
    END::TEXT
  FROM public.schools_school s
  LEFT JOIN public.school_portfolio_assignments spa ON spa.school_id = s.id
  LEFT JOIN auth.users au ON au.id = spa.owner_user_id
  LEFT JOIN public.users pu ON pu.auth_user_id = spa.owner_user_id
  WHERE EXISTS (
    SELECT 1
    FROM public.get_accessible_platform_school_ids(auth.uid()) accessible
    WHERE accessible.school_id = s.id
  )
  ORDER BY s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_saas_audit_logs(p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
  id BIGINT,
  school_id BIGINT,
  user_id UUID,
  action TEXT,
  module TEXT,
  entity_type TEXT,
  entity_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.school_id,
    al.user_id,
    al.action,
    al.module,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.created_at
  FROM public.audit_logs al
  WHERE (
    public.user_has_any_role(auth.uid(), ARRAY['platform_admin', 'support']::public.app_role[])
    OR (
      al.school_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.get_accessible_platform_school_ids(auth.uid()) accessible
        WHERE accessible.school_id = al.school_id
      )
    )
  )
  ORDER BY al.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_saas_school_status(p_school_id BIGINT, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.schools_school
  SET active = p_active
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
  VALUES (
    p_school_id,
    auth.uid(),
    CASE WHEN p_active THEN 'school_activated' ELSE 'school_deactivated' END,
    'saas',
    'school',
    p_school_id::TEXT,
    jsonb_build_object('active', p_active)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_saas_subscription(p_school_id BIGINT, p_plan TEXT, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.schools_school
  SET subscription_plan = p_plan,
      subscription_status = p_status
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
  VALUES (
    p_school_id,
    auth.uid(),
    'subscription_updated',
    'saas',
    'school',
    p_school_id::TEXT,
    jsonb_build_object('subscription_plan', p_plan, 'subscription_status', p_status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_saas_school_details(
  p_school_id BIGINT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_platform_school(auth.uid(), p_school_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.schools_school
  SET name = COALESCE(p_name, name),
      email = COALESCE(p_email, email),
      phone = COALESCE(p_phone, phone),
      city = COALESCE(p_city, city),
      country = COALESCE(p_country, country)
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
  VALUES (
    p_school_id,
    auth.uid(),
    'school_details_updated',
    'saas',
    'school',
    p_school_id::TEXT,
    jsonb_build_object(
      'name', p_name,
      'email', p_email,
      'phone', p_phone,
      'city', p_city,
      'country', p_country
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_school_portfolio(
  p_school_id BIGINT,
  p_owner_user_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_owner_user_id IS NULL THEN
    DELETE FROM public.school_portfolio_assignments
    WHERE school_id = p_school_id;

    INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
    VALUES (p_school_id, auth.uid(), 'portfolio_unassigned', 'saas', 'school', p_school_id::TEXT, '{}'::jsonb);
    RETURN;
  END IF;

  IF NOT public.user_has_any_role(p_owner_user_id, ARRAY['account_manager', 'marketer']::public.app_role[]) THEN
    RAISE EXCEPTION 'Selected user must have the account_manager or marketer role';
  END IF;

  INSERT INTO public.school_portfolio_assignments (school_id, owner_user_id, assigned_by, notes, updated_at)
  VALUES (p_school_id, p_owner_user_id, auth.uid(), COALESCE(p_notes, ''), NOW())
  ON CONFLICT (school_id)
  DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id,
    assigned_by = EXCLUDED.assigned_by,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
  VALUES (
    p_school_id,
    auth.uid(),
    'portfolio_assigned',
    'saas',
    'school',
    p_school_id::TEXT,
    jsonb_build_object('owner_user_id', p_owner_user_id, 'notes', COALESCE(p_notes, ''))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_platform_staff()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  primary_role TEXT,
  roles TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    COALESCE(au.email, '')::TEXT,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unnamed user')::TEXT,
    CASE
      WHEN public.has_role(au.id, 'account_manager') THEN 'account_manager'
      WHEN public.has_role(au.id, 'marketer') THEN 'marketer'
      WHEN public.has_role(au.id, 'support') THEN 'support'
      WHEN public.has_role(au.id, 'platform_admin') THEN 'platform_admin'
      ELSE ''
    END::TEXT,
    COALESCE(
      (
        SELECT array_agg(ur.role::TEXT ORDER BY ur.role::TEXT)
        FROM public.user_roles ur
        WHERE ur.user_id = au.id
          AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer')
      ),
      ARRAY[]::TEXT[]
    )
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_user_id = au.id
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = au.id
      AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer')
  )
  ORDER BY 3, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.onboard_new_school(
  p_name TEXT, p_email TEXT DEFAULT '', p_phone TEXT DEFAULT '', p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '', p_country TEXT DEFAULT 'Kenya', p_plan TEXT DEFAULT 'starter',
  p_contact_person TEXT DEFAULT '', p_contact_phone TEXT DEFAULT ''
)
RETURNS TABLE(school_id BIGINT, school_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
  v_school_code TEXT;
BEGIN
  IF NOT public.user_has_any_role(auth.uid(), ARRAY['platform_admin', 'account_manager', 'marketer']::public.app_role[]) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.schools_school (
    name, email, phone, address, city, country,
    subscription_plan, subscription_status, subscription_start,
    contact_person, contact_phone, active
  ) VALUES (
    p_name, p_email, p_phone, p_address, p_city, p_country,
    p_plan, 'trial', NOW(), p_contact_person, p_contact_phone, TRUE
  ) RETURNING schools_school.id, schools_school.code::TEXT INTO v_school_id, v_school_code;

  INSERT INTO public.school_settings (school_id) VALUES (v_school_id);
  INSERT INTO public.subscriptions (school_id, plan_name, status, start_date, end_date)
  VALUES (v_school_id, p_plan, 'trial', NOW(), NOW() + INTERVAL '30 days');
  INSERT INTO public.onboarding_logs (school_id, step, status, details)
  VALUES (v_school_id, 'school_created', 'completed', jsonb_build_object('name', p_name, 'code', v_school_code));

  IF public.user_has_any_role(auth.uid(), ARRAY['account_manager', 'marketer']::public.app_role[]) THEN
    INSERT INTO public.school_portfolio_assignments (school_id, owner_user_id, assigned_by, notes, updated_at)
    VALUES (v_school_id, auth.uid(), auth.uid(), 'Auto-assigned on onboarding', NOW())
    ON CONFLICT (school_id)
    DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      assigned_by = EXCLUDED.assigned_by,
      notes = EXCLUDED.notes,
      updated_at = NOW();
  END IF;

  RETURN QUERY SELECT v_school_id, v_school_code;
END;
$$;
