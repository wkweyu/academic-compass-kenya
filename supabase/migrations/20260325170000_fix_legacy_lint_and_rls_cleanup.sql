-- Clean up legacy lint failures and normalize schools/users RLS drift.

-- 1. Fix lingering function definitions that still fail Supabase lint.
CREATE OR REPLACE FUNCTION public.create_school_class(
  p_name TEXT,
  p_grade_level INTEGER,
  p_description TEXT DEFAULT ''
)
RETURNS TABLE(
  id BIGINT,
  name TEXT,
  grade_level INTEGER,
  description TEXT,
  school_id BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_school_id BIGINT;
  existing_class_id BIGINT;
BEGIN
  SELECT u.school_id INTO user_school_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();

  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;

  SELECT c.id INTO existing_class_id
  FROM public.classes c
  WHERE c.school_id = user_school_id
    AND (
      c.grade_level = p_grade_level
      OR lower(trim(c.name)) = lower(trim(p_name))
    )
  ORDER BY c.id
  LIMIT 1;

  IF existing_class_id IS NULL THEN
    INSERT INTO public.classes (
      name,
      grade_level,
      description,
      school_id
    ) VALUES (
      p_name,
      p_grade_level,
      COALESCE(p_description, ''),
      user_school_id
    )
    RETURNING classes.id INTO existing_class_id;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name::TEXT,
    c.grade_level,
    c.description::TEXT,
    c.school_id,
    c.created_at
  FROM public.classes c
  WHERE c.id = existing_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_expiring_subscriptions()
RETURNS TABLE (
  school_id BIGINT,
  school_name TEXT,
  end_date DATE,
  days_left INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS school_id,
    s.name::TEXT AS school_name,
    s.subscription_end::DATE AS end_date,
    (s.subscription_end::DATE - CURRENT_DATE)::INTEGER AS days_left
  FROM public.schools_school s
  WHERE s.subscription_end IS NOT NULL
    AND s.subscription_status = 'active'
    AND s.subscription_end <= (CURRENT_DATE + INTERVAL '7 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_due_subscriptions(p_days_ahead INTEGER DEFAULT 14)
RETURNS TABLE (
  school_id BIGINT,
  school_name TEXT,
  subscription_plan TEXT,
  subscription_status TEXT,
  subscription_end DATE,
  days_left INTEGER,
  invoice_id BIGINT,
  invoice_status TEXT,
  invoice_due_date DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH due_schools AS (
    SELECT
      s.id,
      s.name::TEXT AS school_name,
      COALESCE(s.subscription_plan, 'starter')::TEXT AS subscription_plan,
      COALESCE(s.subscription_status, 'active')::TEXT AS subscription_status,
      s.subscription_end::DATE AS subscription_end,
      CASE
        WHEN s.subscription_end IS NULL THEN NULL
        ELSE (s.subscription_end::DATE - CURRENT_DATE)::INT
      END AS days_left
    FROM public.schools_school s
    WHERE
      (s.subscription_end IS NOT NULL AND s.subscription_end::DATE <= CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL)
      OR s.subscription_status IN ('trial', 'trial_expiring', 'expired')
  )
  SELECT
    ds.id,
    ds.school_name,
    ds.subscription_plan,
    ds.subscription_status,
    ds.subscription_end,
    ds.days_left,
    i.id AS invoice_id,
    i.status::TEXT AS invoice_status,
    i.due_date AS invoice_due_date
  FROM due_schools ds
  LEFT JOIN LATERAL (
    SELECT inv.id, inv.status, inv.due_date
    FROM public.saas_invoices inv
    WHERE inv.school_id = ds.id
    ORDER BY inv.due_date DESC NULLS LAST
    LIMIT 1
  ) i ON TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_billing_account_state(p_school_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_subscription RECORD;
  v_policy RECORD;
  v_overdue_invoice RECORD;
  v_open_invoice_count BIGINT := 0;
  v_account_status TEXT := 'payment_pending';
  v_collection_status TEXT := 'none';
  v_subscription_status TEXT;
  v_grace_ends TIMESTAMPTZ;
BEGIN
  v_account_id := public.ensure_billing_account(p_school_id);
  SELECT * INTO v_policy FROM public.get_billing_policy();

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  SELECT COUNT(*)
  INTO v_open_invoice_count
  FROM public.saas_invoices
  WHERE school_id = p_school_id
    AND status IN ('draft', 'sent', 'overdue');

  SELECT * INTO v_overdue_invoice
  FROM public.saas_invoices
  WHERE school_id = p_school_id
    AND status = 'overdue'
  ORDER BY due_date ASC NULLS LAST, id ASC
  LIMIT 1;

  IF v_overdue_invoice.id IS NOT NULL THEN
    v_grace_ends := COALESCE(v_subscription.grace_ends_at, v_overdue_invoice.due_date::TIMESTAMPTZ + make_interval(days => v_policy.grace_days));
    IF NOW() <= v_grace_ends THEN
      v_account_status := 'grace_period';
      v_collection_status := 'grace';
      v_subscription_status := 'grace_period';
    ELSE
      v_account_status := 'past_due';
      v_collection_status := 'suspension_warning';
      v_subscription_status := 'past_due';
    END IF;
  ELSIF v_subscription.id IS NULL THEN
    v_account_status := 'payment_pending';
    v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'upcoming_reminder' ELSE 'none' END;
  ELSIF v_subscription.subscription_status IN ('cancelled', 'churned', 'suspended') THEN
    v_account_status := CASE v_subscription.subscription_status
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'churned' THEN 'churned'
      ELSE 'suspended'
    END;
    v_collection_status := CASE WHEN v_subscription.subscription_status = 'suspended' THEN 'suspended' ELSE 'none' END;
    v_subscription_status := v_subscription.subscription_status;
  ELSIF COALESCE(v_subscription.subscription_status, '') LIKE 'trial%' THEN
    IF v_subscription.trial_ends_at IS NULL OR NOW() <= v_subscription.trial_ends_at THEN
      IF v_subscription.trial_ends_at IS NOT NULL AND v_subscription.trial_ends_at <= NOW() + make_interval(days => v_policy.trial_expiring_days) THEN
        v_account_status := 'trial_expiring';
        v_subscription_status := 'trial_expiring';
      ELSE
        v_account_status := 'trial_active';
        v_subscription_status := 'trial_active';
      END IF;
      v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'upcoming_reminder' ELSE 'none' END;
    ELSE
      v_account_status := 'payment_pending';
      v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'first_reminder' ELSE 'upcoming_reminder' END;
      v_subscription_status := 'payment_pending';
    END IF;
  ELSIF v_subscription.term_end IS NOT NULL AND v_subscription.term_end <= NOW() THEN
    v_account_status := CASE WHEN v_open_invoice_count > 0 THEN 'payment_pending' ELSE 'renewal_due' END;
    v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'first_reminder' ELSE 'upcoming_reminder' END;
    v_subscription_status := CASE WHEN v_open_invoice_count > 0 THEN 'payment_pending' ELSE 'renewal_due' END;
  ELSIF v_subscription.term_end IS NOT NULL AND v_subscription.term_end <= NOW() + make_interval(days => v_policy.renewal_notice_days) THEN
    v_account_status := 'renewal_due';
    v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'upcoming_reminder' ELSE 'none' END;
    v_subscription_status := 'renewal_due';
  ELSE
    v_account_status := 'active';
    v_collection_status := CASE WHEN v_open_invoice_count > 0 THEN 'upcoming_reminder' ELSE 'none' END;
    v_subscription_status := 'active';
  END IF;

  UPDATE public.billing_accounts
  SET
    account_status = v_account_status,
    collection_status = v_collection_status,
    updated_at = NOW()
  WHERE id = v_account_id;

  IF v_subscription.id IS NOT NULL THEN
    UPDATE public.billing_subscriptions
    SET
      subscription_status = COALESCE(v_subscription_status, subscription_status),
      grace_ends_at = CASE WHEN v_account_status = 'grace_period' THEN v_grace_ends ELSE grace_ends_at END,
      updated_at = NOW()
    WHERE id = v_subscription.id;
  END IF;

  PERFORM public.sync_school_projection_from_billing(p_school_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_saas_billing_event(
  p_invoice_id BIGINT,
  p_action TEXT,
  p_details JSONB DEFAULT '{}',
  p_old_status TEXT DEFAULT NULL,
  p_new_status TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.saas_invoices
  WHERE id = p_invoice_id;

  INSERT INTO public.audit_logs (
    school_id,
    user_id,
    action,
    module,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    v_school_id,
    auth.uid(),
    p_action,
    'billing',
    'invoice',
    p_invoice_id::TEXT,
    jsonb_build_object('status', p_old_status),
    p_details || jsonb_build_object('status', p_new_status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_saas_portfolio_event(
  p_school_id BIGINT,
  p_action TEXT,
  p_old_owner_id UUID DEFAULT NULL,
  p_new_owner_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    school_id,
    user_id,
    action,
    module,
    entity_type,
    entity_id,
    old_values,
    new_values
  ) VALUES (
    p_school_id,
    auth.uid(),
    p_action,
    'portfolio',
    'school',
    p_school_id::TEXT,
    jsonb_build_object('owner_id', p_old_owner_id),
    jsonb_build_object('owner_id', p_new_owner_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_school_profile(
  p_name TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_managed_class_groups TEXT[] DEFAULT NULL,
  p_motto TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_logo TEXT DEFAULT NULL
)
RETURNS TABLE(
  id BIGINT,
  name TEXT,
  code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo TEXT,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  type TEXT,
  managed_class_groups TEXT[],
  motto TEXT,
  website TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_school_id BIGINT;
BEGIN
  SELECT u.school_id INTO user_school_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();

  IF user_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not have a school assigned';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.schools_school s
  SET
    name = COALESCE(p_name, s.name),
    address = COALESCE(p_address, s.address),
    phone = COALESCE(p_phone, s.phone),
    email = COALESCE(p_email, s.email),
    type = COALESCE(p_type, s.type),
    managed_class_groups = COALESCE(p_managed_class_groups, s.managed_class_groups),
    motto = COALESCE(p_motto, s.motto),
    website = COALESCE(p_website, s.website),
    logo = COALESCE(p_logo, s.logo)
  WHERE s.id = user_school_id;

  RETURN QUERY
  SELECT
    s.id,
    s.name::TEXT,
    s.code::TEXT,
    s.address::TEXT,
    s.phone::TEXT,
    s.email::TEXT,
    s.logo::TEXT,
    s.active,
    s.created_at,
    s.type::TEXT,
    COALESCE(s.managed_class_groups, ARRAY[]::TEXT[]),
    s.motto::TEXT,
    s.website::TEXT
  FROM public.schools_school s
  WHERE s.id = user_school_id;
END;
$$;

-- 2. Normalize schools_school RLS.
ALTER TABLE public.schools_school ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can create schools" ON public.schools_school;
DROP POLICY IF EXISTS "Users can create school if they don't have one" ON public.schools_school;
DROP POLICY IF EXISTS "Users can create school if they don't have one" ON public.schools_school;
DROP POLICY IF EXISTS "Users can update their school" ON public.schools_school;
DROP POLICY IF EXISTS "Users can view their school" ON public.schools_school;
DROP POLICY IF EXISTS "Platform users can view accessible schools" ON public.schools_school;
DROP POLICY IF EXISTS "Prevent users from deleting schools" ON public.schools_school;

CREATE POLICY "Users can create school if they don't have one"
  ON public.schools_school FOR INSERT TO authenticated
  WITH CHECK (public.user_can_create_school());

CREATE POLICY "Users can view their school"
  ON public.schools_school FOR SELECT TO authenticated
  USING (id = public.get_user_school_id());

CREATE POLICY "Platform users can view accessible schools"
  ON public.schools_school FOR SELECT TO authenticated
  USING (public.can_access_platform_school(auth.uid(), id));

CREATE POLICY "School admins can update their school"
  ON public.schools_school FOR UPDATE TO authenticated
  USING (id = public.get_user_school_id() AND public.is_admin(auth.uid()))
  WITH CHECK (id = public.get_user_school_id() AND public.is_admin(auth.uid()));

CREATE POLICY "Prevent users from deleting schools"
  ON public.schools_school FOR DELETE TO authenticated
  USING (false);

-- 3. Normalize users RLS around auth_user_id instead of the legacy bigint id.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users from their school" ON public.users;
DROP POLICY IF EXISTS "Block direct SELECT on users table" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Prevent regular users from creating users" ON public.users;
DROP POLICY IF EXISTS "Prevent users from deleting users" ON public.users;

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Prevent regular users from creating users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Prevent users from deleting users"
  ON public.users FOR DELETE TO authenticated
  USING (false);