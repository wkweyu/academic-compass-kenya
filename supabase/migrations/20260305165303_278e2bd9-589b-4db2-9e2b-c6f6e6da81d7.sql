
-- 1. Add SaaS fields to schools_school
ALTER TABLE public.schools_school 
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS contact_person TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';

-- 2. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  payment_reference TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create school_settings table
CREATE TABLE IF NOT EXISTS public.school_settings (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL UNIQUE REFERENCES public.schools_school(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'Africa/Nairobi',
  currency TEXT DEFAULT 'KES',
  grading_system TEXT DEFAULT 'cbc',
  report_template TEXT DEFAULT 'default',
  academic_year_start INTEGER DEFAULT 1,
  terms_per_year INTEGER DEFAULT 3,
  sms_provider TEXT DEFAULT '',
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create onboarding_logs table
CREATE TABLE IF NOT EXISTS public.onboarding_logs (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies
CREATE POLICY "School users can view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "Platform admins can manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "School users can view own settings"
  ON public.school_settings FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School admins can update own settings"
  ON public.school_settings FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Platform admins can manage all settings"
  ON public.school_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "School admins can view own audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Platform admins can view all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "Platform admins can manage onboarding"
  ON public.onboarding_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- 8. Functions
CREATE OR REPLACE FUNCTION public.lookup_school_by_code(p_code TEXT)
RETURNS TABLE(id BIGINT, name TEXT, code TEXT, logo TEXT, active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT s.id, s.name::TEXT, s.code::TEXT, s.logo::TEXT, s.active
  FROM public.schools_school s
  WHERE UPPER(s.code) = UPPER(p_code)
    AND s.active = TRUE
    AND s.subscription_status IN ('active', 'trial')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT, p_module TEXT,
  p_entity_type TEXT DEFAULT '', p_entity_id TEXT DEFAULT '',
  p_old_values JSONB DEFAULT '{}', p_new_values JSONB DEFAULT '{}'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, old_values, new_values)
  VALUES (public.get_user_school_id(), auth.uid(), p_action, p_module, p_entity_type, p_entity_id, p_old_values, p_new_values);
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
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM public.schools_school)::BIGINT,
    (SELECT COUNT(*) FROM public.schools_school WHERE active = TRUE AND subscription_status IN ('active', 'trial'))::BIGINT,
    (SELECT COUNT(*) FROM public.schools_school WHERE active = FALSE OR subscription_status NOT IN ('active', 'trial'))::BIGINT,
    (SELECT COUNT(*) FROM public.students WHERE is_active = TRUE)::BIGINT,
    (SELECT COUNT(*) FROM public.teachers WHERE is_active = TRUE)::BIGINT,
    (SELECT COUNT(*) FROM public.schools_school WHERE subscription_plan = 'starter')::BIGINT,
    (SELECT COUNT(*) FROM public.schools_school WHERE subscription_plan = 'standard')::BIGINT,
    (SELECT COUNT(*) FROM public.schools_school WHERE subscription_plan = 'enterprise')::BIGINT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_schools()
RETURNS TABLE(
  id BIGINT, name TEXT, code TEXT, email TEXT, phone TEXT,
  city TEXT, country TEXT, subscription_plan TEXT, subscription_status TEXT,
  subscription_end TIMESTAMPTZ, active BOOLEAN, created_at TIMESTAMPTZ,
  student_count BIGINT, teacher_count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY SELECT 
    s.id, s.name::TEXT, s.code::TEXT, s.email::TEXT, s.phone::TEXT,
    COALESCE(s.city, '')::TEXT, COALESCE(s.country, 'Kenya')::TEXT,
    COALESCE(s.subscription_plan, 'starter')::TEXT,
    COALESCE(s.subscription_status, 'active')::TEXT,
    s.subscription_end, s.active, s.created_at,
    (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.id AND st.is_active = TRUE)::BIGINT,
    (SELECT COUNT(*) FROM public.teachers t WHERE t.school_id = s.id AND t.is_active = TRUE)::BIGINT
  FROM public.schools_school s ORDER BY s.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.onboard_new_school(
  p_name TEXT, p_email TEXT, p_phone TEXT DEFAULT '', p_address TEXT DEFAULT '',
  p_city TEXT DEFAULT '', p_country TEXT DEFAULT 'Kenya', p_plan TEXT DEFAULT 'starter',
  p_contact_person TEXT DEFAULT '', p_contact_phone TEXT DEFAULT ''
)
RETURNS TABLE(school_id BIGINT, school_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_school_id BIGINT; v_school_code TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
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
  RETURN QUERY SELECT v_school_id, v_school_code;
END;
$$;

-- Update is_admin to include platform_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('superadmin', 'schooladmin', 'platform_admin')
  )
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schools_code_upper ON public.schools_school (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_audit_logs_school ON public.audit_logs (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
