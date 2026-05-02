-- Phase 2: Canonical billing workflows and legacy compatibility wrappers

-- 1. Allow canonical billing workflows to update school projection fields without
--    triggering reverse synchronization from school fields back into billing tables.
CREATE OR REPLACE FUNCTION public.handle_school_billing_projection_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(current_setting('app.skip_school_billing_sync', TRUE), '0') = '1' THEN
    RETURN NEW;
  END IF;

  PERFORM public.sync_school_billing_projection(NEW.id);
  RETURN NEW;
END;
$$;

-- 2. Billing policy and helper routines
CREATE OR REPLACE FUNCTION public.get_billing_policy()
RETURNS TABLE (
  trial_default_days INTEGER,
  trial_expiring_days INTEGER,
  renewal_notice_days INTEGER,
  invoice_due_days INTEGER,
  grace_days INTEGER,
  overdue_reminder_spacing_days INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 30, 7, 14, 7, 7, 3;
$$;

CREATE OR REPLACE FUNCTION public.billing_cycle_interval(p_cycle TEXT)
RETURNS INTERVAL
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN CASE LOWER(COALESCE(p_cycle, 'annual'))
    WHEN 'monthly' THEN INTERVAL '1 month'
    WHEN 'quarterly' THEN INTERVAL '3 months'
    WHEN 'annual' THEN INTERVAL '1 year'
    WHEN 'trial' THEN INTERVAL '30 days'
    ELSE INTERVAL '1 year'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_billing_domain_event(
  p_school_id BIGINT,
  p_event_type TEXT,
  p_billing_account_id BIGINT DEFAULT NULL,
  p_billing_subscription_id BIGINT DEFAULT NULL,
  p_invoice_id BIGINT DEFAULT NULL,
  p_payment_id BIGINT DEFAULT NULL,
  p_event_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT := p_billing_account_id;
BEGIN
  IF v_account_id IS NULL AND p_school_id IS NOT NULL THEN
    SELECT id INTO v_account_id
    FROM public.billing_accounts
    WHERE school_id = p_school_id;
  END IF;

  INSERT INTO public.billing_events (
    billing_account_id,
    billing_subscription_id,
    school_id,
    invoice_id,
    payment_id,
    event_type,
    event_payload,
    occurred_at,
    created_by
  ) VALUES (
    v_account_id,
    p_billing_subscription_id,
    p_school_id,
    p_invoice_id,
    p_payment_id,
    p_event_type,
    COALESCE(p_event_payload, '{}'::jsonb),
    NOW(),
    auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_school_projection_from_billing(p_school_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot RECORD;
  v_status TEXT;
  v_active BOOLEAN;
BEGIN
  SELECT * INTO v_snapshot
  FROM public.billing_account_snapshot_v1
  WHERE school_id = p_school_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_status := CASE
    WHEN v_snapshot.subscription_status IN ('trial_active', 'trial_expiring') THEN 'trial'
    WHEN v_snapshot.subscription_status = 'grace_period' THEN 'active'
    WHEN v_snapshot.subscription_status = 'past_due' THEN 'expired'
    WHEN v_snapshot.subscription_status = 'renewal_due' THEN 'active'
    ELSE COALESCE(v_snapshot.subscription_status, v_snapshot.account_status, 'active')
  END;

  v_active := v_snapshot.account_status IN ('trial_active', 'trial_expiring', 'active', 'renewal_due', 'grace_period');

  PERFORM set_config('app.skip_school_billing_sync', '1', TRUE);

  UPDATE public.schools_school
  SET
    subscription_plan = COALESCE(v_snapshot.current_plan, subscription_plan),
    subscription_status = v_status,
    subscription_start = COALESCE(v_snapshot.term_start, subscription_start),
    subscription_end = COALESCE(v_snapshot.term_end, v_snapshot.trial_ends_at, subscription_end),
    active = v_active,
    updated_at = NOW()
  WHERE id = p_school_id;

  PERFORM set_config('app.skip_school_billing_sync', '0', TRUE);
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
  v_overdue_invoice_count BIGINT := 0;
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

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'overdue')
  INTO v_open_invoice_count, v_overdue_invoice_count
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

-- 3. Canonical workflow entry points
CREATE OR REPLACE FUNCTION public.start_school_trial(
  p_school_id BIGINT,
  p_plan_name TEXT DEFAULT NULL,
  p_trial_days INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  billing_account_id BIGINT,
  billing_subscription_id BIGINT,
  trial_ends_at TIMESTAMPTZ,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_subscription RECORD;
  v_plan RECORD;
  v_policy RECORD;
  v_trial_days INTEGER;
  v_start TIMESTAMPTZ := NOW();
  v_end TIMESTAMPTZ;
  v_subscription_id BIGINT;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_account_id := public.ensure_billing_account(p_school_id);
  SELECT * INTO v_policy FROM public.get_billing_policy();
  v_trial_days := COALESCE(p_trial_days, v_policy.trial_default_days, 30);

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE LOWER(name) = LOWER(COALESCE(p_plan_name, (SELECT subscription_plan FROM public.schools_school WHERE id = p_school_id), 'starter'))
  LIMIT 1;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  v_end := v_start + make_interval(days => v_trial_days);

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    INSERT INTO public.billing_subscriptions (
      billing_account_id,
      school_id,
      plan_id,
      plan_name,
      subscription_status,
      billing_cycle,
      term_start,
      term_end,
      trial_starts_at,
      trial_ends_at,
      auto_renew,
      renewal_mode,
      price_snapshot,
      created_from,
      is_current,
      metadata
    ) VALUES (
      v_account_id,
      p_school_id,
      v_plan.id,
      v_plan.name,
      'trial_active',
      'trial',
      v_start,
      v_end,
      v_start,
      v_end,
      FALSE,
      'sales_assisted',
      jsonb_build_object(
        'plan_id', v_plan.id,
        'monthly_price', v_plan.monthly_price,
        'yearly_price', v_plan.yearly_price,
        'features', v_plan.features,
        'max_students', v_plan.max_students,
        'max_users', v_plan.max_users
      ),
      'phase2_trial_start',
      TRUE,
      jsonb_build_object('reason', COALESCE(p_reason, 'trial started'))
    ) RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.billing_subscriptions
    SET
      plan_id = v_plan.id,
      plan_name = v_plan.name,
      subscription_status = 'trial_active',
      billing_cycle = 'trial',
      term_start = v_start,
      term_end = v_end,
      trial_starts_at = v_start,
      trial_ends_at = v_end,
      grace_ends_at = NULL,
      cancelled_at = NULL,
      cancel_reason = NULL,
      auto_renew = FALSE,
      renewal_mode = 'sales_assisted',
      price_snapshot = jsonb_build_object(
        'plan_id', v_plan.id,
        'monthly_price', v_plan.monthly_price,
        'yearly_price', v_plan.yearly_price,
        'features', v_plan.features,
        'max_students', v_plan.max_students,
        'max_users', v_plan.max_users
      ),
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('reason', COALESCE(p_reason, 'trial started'))
    WHERE id = v_subscription.id
    RETURNING id INTO v_subscription_id;
  END IF;

  UPDATE public.billing_accounts
  SET account_status = 'trial_active', collection_status = 'none', updated_at = NOW()
  WHERE id = v_account_id;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.trial_started',
    v_account_id,
    v_subscription_id,
    NULL,
    NULL,
    jsonb_build_object('plan_name', v_plan.name, 'trial_days', v_trial_days, 'reason', p_reason)
  );

  PERFORM public.recalculate_billing_account_state(p_school_id);

  RETURN QUERY
  SELECT v_account_id, v_subscription_id, v_end, ba.account_status
  FROM public.billing_accounts ba
  WHERE ba.id = v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.extend_billing_trial(
  p_school_id BIGINT,
  p_new_end_date DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subscription RECORD;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'Active billing subscription not found';
  END IF;

  UPDATE public.billing_subscriptions
  SET
    subscription_status = CASE
      WHEN p_new_end_date::TIMESTAMPTZ <= NOW() + INTERVAL '7 days' THEN 'trial_expiring'
      ELSE 'trial_active'
    END,
    billing_cycle = 'trial',
    trial_starts_at = COALESCE(trial_starts_at, term_start, NOW()),
    trial_ends_at = p_new_end_date::TIMESTAMPTZ,
    term_end = p_new_end_date::TIMESTAMPTZ,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('trial_extension_reason', p_reason)
  WHERE id = v_subscription.id;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.trial_extended',
    v_subscription.billing_account_id,
    v_subscription.id,
    NULL,
    NULL,
    jsonb_build_object('new_end_date', p_new_end_date, 'reason', p_reason)
  );

  PERFORM public.recalculate_billing_account_state(p_school_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_billing_subscription_term(
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
  v_subscription RECORD;
  v_next_status TEXT;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'Active billing subscription not found';
  END IF;

  v_next_status := COALESCE(NULLIF(p_new_status, ''), v_subscription.subscription_status, 'active');

  UPDATE public.billing_subscriptions
  SET
    subscription_status = v_next_status,
    billing_cycle = CASE WHEN billing_cycle = 'trial' THEN 'annual' ELSE billing_cycle END,
    term_end = p_new_end_date::TIMESTAMPTZ,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('term_adjustment_reason', p_reason)
  WHERE id = v_subscription.id;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.subscription_term_adjusted',
    v_subscription.billing_account_id,
    v_subscription.id,
    NULL,
    NULL,
    jsonb_build_object('new_end_date', p_new_end_date, 'new_status', v_next_status, 'reason', p_reason)
  );

  PERFORM public.recalculate_billing_account_state(p_school_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_billing_invoice(
  p_school_id BIGINT,
  p_invoice_type TEXT DEFAULT 'manual',
  p_amount DECIMAL DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_subscription RECORD;
  v_plan RECORD;
  v_invoice_id BIGINT;
  v_invoice_number TEXT;
  v_policy RECORD;
  v_amount DECIMAL(12,2);
  v_due_date DATE;
  v_prefix TEXT;
  v_period_start DATE;
  v_period_end DATE;
  v_description TEXT;
  v_invoice_type TEXT := LOWER(COALESCE(p_invoice_type, 'manual'));
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_policy FROM public.get_billing_policy();
  v_account_id := public.ensure_billing_account(p_school_id);

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  IF v_subscription.id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM public.subscription_plans
    WHERE id = v_subscription.plan_id
    LIMIT 1;
  END IF;

  v_amount := COALESCE(
    p_amount,
    CASE v_invoice_type
      WHEN 'onboarding' THEN COALESCE((v_subscription.price_snapshot ->> 'onboarding_fee')::DECIMAL, NULL)
      WHEN 'subscription_renewal' THEN COALESCE((v_subscription.price_snapshot ->> 'yearly_price')::DECIMAL, v_plan.yearly_price)
      WHEN 'subscription' THEN COALESCE((v_subscription.price_snapshot ->> 'yearly_price')::DECIMAL, v_plan.yearly_price)
      ELSE NULL
    END,
    v_plan.yearly_price,
    0
  );

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice amount must be greater than zero';
  END IF;

  v_due_date := COALESCE(p_due_date, CURRENT_DATE + make_interval(days => v_policy.invoice_due_days));
  v_period_start := COALESCE(p_period_start, v_subscription.term_end::DATE, CURRENT_DATE);
  v_period_end := COALESCE(
    p_period_end,
    CASE
      WHEN v_subscription.id IS NOT NULL THEN (v_period_start::TIMESTAMPTZ + public.billing_cycle_interval(v_subscription.billing_cycle))::DATE
      ELSE (v_period_start::TIMESTAMPTZ + INTERVAL '1 year')::DATE
    END
  );
  v_description := COALESCE(
    p_description,
    CASE v_invoice_type
      WHEN 'onboarding' THEN 'Onboarding fee'
      WHEN 'subscription_renewal' THEN 'Subscription renewal'
      WHEN 'subscription' THEN 'Subscription charge'
      WHEN 'adjustment' THEN 'Billing adjustment'
      ELSE 'Manual invoice'
    END
  );

  v_prefix := CASE v_invoice_type
    WHEN 'onboarding' THEN 'ONB'
    WHEN 'subscription_renewal' THEN 'REN'
    WHEN 'subscription' THEN 'SUB'
    WHEN 'adjustment' THEN 'ADJ'
    ELSE 'INV'
  END;

  v_invoice_number := v_prefix || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.saas_invoices (
    school_id,
    billing_account_id,
    billing_subscription_id,
    invoice_number,
    amount,
    status,
    due_date,
    billing_period_start,
    billing_period_end,
    items,
    invoice_type,
    subtotal,
    tax_amount,
    total_amount,
    balance_due,
    issued_at,
    collection_stage,
    metadata
  ) VALUES (
    p_school_id,
    v_account_id,
    v_subscription.id,
    v_invoice_number,
    v_amount,
    'draft',
    v_due_date,
    v_period_start,
    v_period_end,
    jsonb_build_array(
      jsonb_build_object(
        'description', v_description,
        'amount', v_amount,
        'qty', 1,
        'invoice_type', v_invoice_type
      )
    ),
    v_invoice_type,
    v_amount,
    0,
    v_amount,
    v_amount,
    NOW(),
    'none',
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_invoice_id;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.invoice_issued',
    v_account_id,
    v_subscription.id,
    v_invoice_id,
    NULL,
    jsonb_build_object('invoice_type', v_invoice_type, 'amount', v_amount, 'due_date', v_due_date)
  );

  PERFORM public.recalculate_billing_account_state(p_school_id);

  RETURN v_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_billing_payment(
  p_invoice_id BIGINT,
  p_amount DECIMAL DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'Manual',
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  payment_id BIGINT,
  invoice_status TEXT,
  balance_due DECIMAL,
  subscription_status TEXT,
  account_status TEXT,
  term_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_subscription RECORD;
  v_account RECORD;
  v_payment_id BIGINT;
  v_amount DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_new_invoice_status TEXT;
  v_new_term_start TIMESTAMPTZ;
  v_new_term_end TIMESTAMPTZ;
  v_cycle TEXT;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_invoice
  FROM public.saas_invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT * INTO v_account
  FROM public.billing_accounts
  WHERE id = COALESCE(v_invoice.billing_account_id, public.ensure_billing_account(v_invoice.school_id))
  FOR UPDATE;

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE id = COALESCE(
    v_invoice.billing_subscription_id,
    (
      SELECT bs.id
      FROM public.billing_subscriptions bs
      WHERE bs.school_id = v_invoice.school_id
        AND bs.is_current = TRUE
      ORDER BY bs.updated_at DESC, bs.id DESC
      LIMIT 1
    )
  )
  FOR UPDATE;

  v_amount := COALESCE(p_amount, v_invoice.balance_due, v_invoice.total_amount, v_invoice.amount);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_new_balance := GREATEST(0, COALESCE(v_invoice.balance_due, v_invoice.total_amount, v_invoice.amount) - v_amount);
  v_new_invoice_status := CASE WHEN v_new_balance = 0 THEN 'paid' ELSE 'sent' END;

  UPDATE public.saas_invoices
  SET
    status = v_new_invoice_status,
    paid_at = CASE WHEN v_new_balance = 0 THEN COALESCE(paid_at, NOW()) ELSE paid_at END,
    balance_due = v_new_balance,
    updated_at = NOW(),
    items = COALESCE(items, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'payment_info', jsonb_build_object(
          'method', p_payment_method,
          'ref', p_reference,
          'amount', v_amount,
          'notes', p_notes,
          'recorded_at', NOW()
        )
      )
    )
  WHERE id = p_invoice_id;

  INSERT INTO public.billing_payments (
    billing_account_id,
    school_id,
    invoice_id,
    amount,
    currency,
    payment_method,
    payment_reference,
    payment_channel,
    received_at,
    recorded_by,
    reconciliation_status,
    notes,
    metadata
  ) VALUES (
    v_account.id,
    v_invoice.school_id,
    v_invoice.id,
    v_amount,
    COALESCE(v_invoice.currency, v_account.currency, 'KES'),
    p_payment_method,
    p_reference,
    'manual',
    NOW(),
    auth.uid(),
    CASE WHEN v_new_balance = 0 THEN 'matched' ELSE 'partially_matched' END,
    p_notes,
    jsonb_build_object('invoice_type', v_invoice.invoice_type)
  ) RETURNING id INTO v_payment_id;

  IF v_new_balance = 0 AND v_subscription.id IS NOT NULL AND v_invoice.invoice_type IN ('subscription', 'subscription_renewal') THEN
    v_cycle := CASE WHEN v_subscription.billing_cycle = 'trial' THEN 'annual' ELSE COALESCE(v_subscription.billing_cycle, 'annual') END;
    v_new_term_start := COALESCE(v_invoice.billing_period_start::TIMESTAMPTZ, GREATEST(COALESCE(v_subscription.term_end, NOW()), NOW()));
    v_new_term_end := COALESCE(v_invoice.billing_period_end::TIMESTAMPTZ, v_new_term_start + public.billing_cycle_interval(v_cycle));

    UPDATE public.billing_subscriptions
    SET
      subscription_status = 'active',
      billing_cycle = v_cycle,
      term_start = v_new_term_start,
      term_end = v_new_term_end,
      grace_ends_at = NULL,
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('last_payment_id', v_payment_id, 'last_invoice_id', v_invoice.id)
    WHERE id = v_subscription.id;
  ELSIF v_new_balance = 0 AND v_subscription.id IS NOT NULL AND v_subscription.subscription_status = 'payment_pending' THEN
    UPDATE public.billing_subscriptions
    SET subscription_status = 'active', updated_at = NOW()
    WHERE id = v_subscription.id;
  END IF;

  PERFORM public.log_billing_domain_event(
    v_invoice.school_id,
    'billing.payment_posted',
    v_account.id,
    v_subscription.id,
    v_invoice.id,
    v_payment_id,
    jsonb_build_object('amount', v_amount, 'balance_due', v_new_balance, 'method', p_payment_method, 'reference', p_reference)
  );

  PERFORM public.recalculate_billing_account_state(v_invoice.school_id);

  RETURN QUERY
  SELECT
    v_payment_id,
    i.status,
    COALESCE(i.balance_due, 0),
    bs.subscription_status,
    ba.account_status,
    bs.term_end
  FROM public.saas_invoices i
  JOIN public.billing_accounts ba ON ba.id = v_account.id
  LEFT JOIN public.billing_subscriptions bs ON bs.id = COALESCE(v_subscription.id, i.billing_subscription_id)
  WHERE i.id = p_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_billing_renewals(p_days_ahead INTEGER DEFAULT 10)
RETURNS TABLE (
  school_id BIGINT,
  invoice_id BIGINT,
  amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_invoice_id BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_row IN
    SELECT
      bs.school_id,
      bs.id AS billing_subscription_id,
      bs.term_end,
      COALESCE((bs.price_snapshot ->> 'yearly_price')::DECIMAL, sp.yearly_price, 0) AS renewal_amount
    FROM public.billing_subscriptions bs
    LEFT JOIN public.subscription_plans sp ON sp.id = bs.plan_id
    WHERE bs.is_current = TRUE
      AND bs.subscription_status IN ('active', 'renewal_due')
      AND bs.term_end IS NOT NULL
      AND bs.term_end::DATE <= CURRENT_DATE + p_days_ahead
      AND bs.term_end::DATE >= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1
        FROM public.saas_invoices i
        WHERE i.school_id = bs.school_id
          AND i.invoice_type = 'subscription_renewal'
          AND i.status IN ('draft', 'sent', 'paid', 'overdue')
          AND i.billing_period_start = bs.term_end::DATE
      )
  LOOP
    v_invoice_id := public.issue_billing_invoice(
      v_row.school_id,
      'subscription_renewal',
      v_row.renewal_amount,
      v_row.term_end::DATE,
      'Annual subscription renewal',
      v_row.term_end::DATE,
      (v_row.term_end + INTERVAL '1 year')::DATE,
      jsonb_build_object('source', 'process_due_billing_renewals')
    );

    school_id := v_row.school_id;
    invoice_id := v_invoice_id;
    amount := v_row.renewal_amount;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_billing_collection_action(
  p_school_id BIGINT,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  account_status TEXT,
  collection_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account RECORD;
  v_subscription RECORD;
  v_action TEXT := LOWER(COALESCE(p_action, ''));
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_account
  FROM public.billing_accounts
  WHERE school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing account not found';
  END IF;

  SELECT * INTO v_subscription
  FROM public.billing_subscriptions
  WHERE school_id = p_school_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_action = 'mark_grace' THEN
    UPDATE public.billing_accounts
    SET account_status = 'grace_period', collection_status = 'grace', updated_at = NOW()
    WHERE id = v_account.id;

    IF v_subscription.id IS NOT NULL THEN
      UPDATE public.billing_subscriptions
      SET subscription_status = 'grace_period', grace_ends_at = NOW() + INTERVAL '7 days', updated_at = NOW()
      WHERE id = v_subscription.id;
    END IF;
  ELSIF v_action = 'suspend' THEN
    UPDATE public.billing_accounts
    SET account_status = 'suspended', collection_status = 'suspended', updated_at = NOW()
    WHERE id = v_account.id;

    IF v_subscription.id IS NOT NULL THEN
      UPDATE public.billing_subscriptions
      SET subscription_status = 'suspended', updated_at = NOW()
      WHERE id = v_subscription.id;
    END IF;
  ELSIF v_action = 'restore' THEN
    UPDATE public.billing_accounts
    SET account_status = 'active', collection_status = 'recovery', updated_at = NOW()
    WHERE id = v_account.id;

    IF v_subscription.id IS NOT NULL THEN
      UPDATE public.billing_subscriptions
      SET subscription_status = 'active', grace_ends_at = NULL, updated_at = NOW()
      WHERE id = v_subscription.id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported billing action';
  END IF;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.collection_action_applied',
    v_account.id,
    v_subscription.id,
    NULL,
    NULL,
    jsonb_build_object('action', v_action, 'reason', p_reason)
  );

  PERFORM public.recalculate_billing_account_state(p_school_id);

  RETURN QUERY
  SELECT ba.account_status, ba.collection_status
  FROM public.billing_accounts ba
  WHERE ba.id = v_account.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_school_billing(
  p_school_id BIGINT,
  p_plan_name TEXT DEFAULT NULL,
  p_trial_days INTEGER DEFAULT NULL,
  p_invoice_strategy TEXT DEFAULT 'trial_only',
  p_onboarding_fee DECIMAL DEFAULT NULL,
  p_term_fee DECIMAL DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  billing_account_id BIGINT,
  billing_subscription_id BIGINT,
  onboarding_invoice_id BIGINT,
  subscription_invoice_id BIGINT,
  account_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trial RECORD;
  v_onboarding_invoice_id BIGINT;
  v_subscription_invoice_id BIGINT;
  v_strategy TEXT := LOWER(COALESCE(p_invoice_strategy, 'trial_only'));
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_trial
  FROM public.start_school_trial(p_school_id, p_plan_name, p_trial_days, p_reason);

  IF v_strategy IN ('onboarding_only', 'onboarding_and_term') THEN
    v_onboarding_invoice_id := public.issue_billing_invoice(
      p_school_id,
      'onboarding',
      COALESCE(p_onboarding_fee, 50000),
      CURRENT_DATE + 7,
      'Onboarding fee',
      CURRENT_DATE,
      CURRENT_DATE,
      jsonb_build_object('source', 'initialize_school_billing')
    );
  END IF;

  IF v_strategy IN ('term_only', 'onboarding_and_term') THEN
    v_subscription_invoice_id := public.issue_billing_invoice(
      p_school_id,
      'subscription',
      p_term_fee,
      CURRENT_DATE + 7,
      'Initial subscription charge',
      CURRENT_DATE,
      (CURRENT_DATE::TIMESTAMPTZ + INTERVAL '1 year')::DATE,
      jsonb_build_object('source', 'initialize_school_billing')
    );
  END IF;

  PERFORM public.log_billing_domain_event(
    p_school_id,
    'billing.initialized',
    v_trial.billing_account_id,
    v_trial.billing_subscription_id,
    NULL,
    NULL,
    jsonb_build_object('invoice_strategy', v_strategy, 'reason', p_reason)
  );

  RETURN QUERY
  SELECT
    v_trial.billing_account_id,
    v_trial.billing_subscription_id,
    v_onboarding_invoice_id,
    v_subscription_invoice_id,
    ba.account_status
  FROM public.billing_accounts ba
  WHERE ba.id = v_trial.billing_account_id;
END;
$$;

-- 4. Legacy compatibility wrappers now delegate to canonical workflows
CREATE OR REPLACE FUNCTION public.generate_saas_invoice(
  p_school_id BIGINT,
  p_amount DECIMAL,
  p_due_date DATE,
  p_items JSONB,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_description TEXT;
BEGIN
  v_description := COALESCE(p_items -> 0 ->> 'description', 'Manual invoice');

  RETURN public.issue_billing_invoice(
    p_school_id,
    'manual',
    p_amount,
    p_due_date,
    v_description,
    p_period_start,
    p_period_end,
    jsonb_build_object('items', COALESCE(p_items, '[]'::jsonb), 'source', 'generate_saas_invoice')
  );
END;
$$;

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
BEGIN
  PERFORM public.adjust_billing_subscription_term(p_school_id, p_new_end_date, p_new_status, p_reason);
END;
$$;

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
  PERFORM public.extend_billing_trial(p_school_id, p_new_end_date, p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id BIGINT,
  p_payment_method TEXT DEFAULT 'Manual',
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.post_billing_payment(p_invoice_id, NULL, p_payment_method, p_reference, 'Legacy payment record');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment_v2(
  p_invoice_id BIGINT,
  p_payment_method TEXT DEFAULT 'Manual',
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.post_billing_payment(p_invoice_id, NULL, p_payment_method, p_reference, 'Enhanced legacy payment record');
  PERFORM public.log_saas_billing_event(
    p_invoice_id,
    'PAYMENT_RECORDED',
    jsonb_build_object('method', p_payment_method, 'reference', p_reference),
    NULL,
    'paid'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_renewal_invoices()
RETURNS TABLE (
  school_id BIGINT,
  invoice_id BIGINT,
  amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.process_due_billing_renewals(10);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER;
  v_school_id BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.saas_invoices
  SET
    status = 'overdue',
    collection_stage = 'grace',
    last_reminder_at = COALESCE(last_reminder_at, NOW()),
    next_follow_up_at = COALESCE(next_follow_up_at, NOW() + INTERVAL '3 days'),
    updated_at = NOW()
  WHERE status IN ('draft', 'sent')
    AND due_date < CURRENT_DATE
    AND COALESCE(balance_due, total_amount, amount) > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  FOR v_school_id IN
    SELECT DISTINCT school_id
    FROM public.saas_invoices
    WHERE status = 'overdue'
  LOOP
    PERFORM public.recalculate_billing_account_state(v_school_id);
  END LOOP;

  IF v_updated_count > 0 THEN
    INSERT INTO public.saas_communications (
      subject, content, category, type, status, sent_at
    ) VALUES (
      'System: Invoices marked overdue',
      'Automatically updated ' || v_updated_count || ' invoices to overdue status.',
      'billing',
      'system_notification',
      'sent',
      NOW()
    );
  END IF;

  RETURN v_updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_school_subscription_history(p_school_id BIGINT)
RETURNS TABLE (
  id BIGINT,
  plan_name TEXT,
  status TEXT,
  amount DECIMAL,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.can_view_platform_console(auth.uid()) OR public.get_user_school_id() = p_school_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    bs.id,
    bs.plan_name,
    bs.subscription_status,
    COALESCE((bs.price_snapshot ->> 'amount')::DECIMAL, (bs.price_snapshot ->> 'yearly_price')::DECIMAL, 0)::DECIMAL,
    bs.term_start,
    bs.term_end,
    bs.created_at
  FROM public.billing_subscriptions bs
  WHERE bs.school_id = p_school_id
  ORDER BY bs.created_at DESC, bs.id DESC;
END;
$$;