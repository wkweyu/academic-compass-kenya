-- Subscription extensions and due tracking helpers

-- 1) Extend or adjust a subscription/trial end date
CREATE OR REPLACE FUNCTION public.extend_subscription_period(
  p_school_id BIGINT,
  p_new_end_date DATE,
  p_new_status TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current RECORD;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id, subscription_status, subscription_start
  INTO v_current
  FROM public.schools_school
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  UPDATE public.schools_school
  SET
    subscription_end = p_new_end_date,
    subscription_status = COALESCE(p_new_status, v_current.subscription_status),
    subscription_start = COALESCE(v_current.subscription_start, CURRENT_DATE)
  WHERE id = p_school_id;

  -- Optional: log the extension into communications for audit
  INSERT INTO public.saas_communications (
    school_id, subject, content, category, type, status, sent_at
  ) VALUES (
    p_school_id,
    'Subscription extended',
    COALESCE('Reason: ' || p_reason, 'Subscription end date adjusted'),
    'billing',
    'system_notification',
    'sent',
    NOW()
  );
END;
$$;

-- 2) Convenience wrapper for trial extensions
CREATE OR REPLACE FUNCTION public.extend_trial(
  p_school_id BIGINT,
  p_new_end_date DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.extend_subscription_period(p_school_id, p_new_end_date, 'trial', p_reason);
END;
$$;

-- 3) View-like RPC to pull due/expiring schools and their latest invoice
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
      s.name,
      COALESCE(s.subscription_plan, 'starter') AS subscription_plan,
      COALESCE(s.subscription_status, 'active') AS subscription_status,
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
    ds.name,
    ds.subscription_plan,
    ds.subscription_status,
    ds.subscription_end,
    ds.days_left,
    i.id AS invoice_id,
    i.status AS invoice_status,
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
