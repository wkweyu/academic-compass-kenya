-- Phase 1: Canonical billing model, backfill, and compatibility read models

-- 1. Canonical billing tables
CREATE TABLE IF NOT EXISTS public.billing_accounts (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL UNIQUE REFERENCES public.schools_school(id) ON DELETE CASCADE,
  account_status TEXT NOT NULL DEFAULT 'trial_pending_setup'
    CHECK (account_status IN (
      'lead',
      'onboarding_pending',
      'trial_pending_setup',
      'trial_active',
      'trial_expiring',
      'payment_pending',
      'active',
      'renewal_due',
      'grace_period',
      'past_due',
      'suspended',
      'cancelled',
      'churned'
    )),
  collection_status TEXT NOT NULL DEFAULT 'none'
    CHECK (collection_status IN (
      'none',
      'upcoming_reminder',
      'first_reminder',
      'second_reminder',
      'final_notice',
      'grace',
      'suspension_warning',
      'suspended',
      'recovery'
    )),
  billing_owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_email TEXT,
  currency TEXT NOT NULL DEFAULT 'KES',
  country TEXT NOT NULL DEFAULT 'Kenya',
  tax_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  billing_account_id BIGINT NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  legacy_subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id BIGINT REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'trial_active'
    CHECK (subscription_status IN (
      'trial_pending_setup',
      'trial_active',
      'trial_expiring',
      'payment_pending',
      'active',
      'renewal_due',
      'grace_period',
      'past_due',
      'suspended',
      'cancelled',
      'expired',
      'churned'
    )),
  billing_cycle TEXT NOT NULL DEFAULT 'annual'
    CHECK (billing_cycle IN ('trial', 'monthly', 'quarterly', 'annual', 'one_time', 'manual')),
  term_start TIMESTAMPTZ NOT NULL,
  term_end TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  renewal_mode TEXT NOT NULL DEFAULT 'manual_invoice'
    CHECK (renewal_mode IN ('manual_invoice', 'auto_invoice', 'sales_assisted', 'manual_only', 'cancelled')),
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  price_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_from TEXT NOT NULL DEFAULT 'migration',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_payments (
  id BIGSERIAL PRIMARY KEY,
  billing_account_id BIGINT NOT NULL REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES public.saas_invoices(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  payment_method TEXT NOT NULL DEFAULT 'Manual',
  payment_reference TEXT,
  payment_channel TEXT NOT NULL DEFAULT 'manual',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reconciliation_status TEXT NOT NULL DEFAULT 'recorded'
    CHECK (reconciliation_status IN ('recorded', 'matched', 'partially_matched', 'unmatched', 'reversed')),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id BIGSERIAL PRIMARY KEY,
  billing_account_id BIGINT REFERENCES public.billing_accounts(id) ON DELETE CASCADE,
  billing_subscription_id BIGINT REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE CASCADE,
  invoice_id BIGINT REFERENCES public.saas_invoices(id) ON DELETE CASCADE,
  payment_id BIGINT REFERENCES public.billing_payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_legacy_subscription
  ON public.billing_subscriptions (legacy_subscription_id)
  WHERE legacy_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_current_account
  ON public.billing_subscriptions (billing_account_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_school_current
  ON public.billing_subscriptions (school_id, is_current, term_end DESC);

CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice
  ON public.billing_payments (invoice_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_events_account_time
  ON public.billing_events (billing_account_id, occurred_at DESC);

-- 2. Extend invoices with canonical billing metadata while preserving compatibility
ALTER TABLE public.saas_invoices
  ADD COLUMN IF NOT EXISTS billing_account_id BIGINT REFERENCES public.billing_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_subscription_id BIGINT REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'subscription'
    CHECK (invoice_type IN ('onboarding', 'subscription', 'subscription_renewal', 'proration', 'adjustment', 'credit_note', 'manual')),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS balance_due DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collection_stage TEXT NOT NULL DEFAULT 'none'
    CHECK (collection_stage IN (
      'none',
      'upcoming_reminder',
      'first_reminder',
      'second_reminder',
      'final_notice',
      'grace',
      'suspension_warning',
      'suspended',
      'recovery'
    )),
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_saas_invoices_billing_account_status
  ON public.saas_invoices (billing_account_id, status, due_date);

-- 3. RLS for canonical billing tables
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing accounts" ON public.billing_accounts;
CREATE POLICY "Users can view own billing accounts"
  ON public.billing_accounts FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

DROP POLICY IF EXISTS "Platform console can manage billing accounts" ON public.billing_accounts;
CREATE POLICY "Platform console can manage billing accounts"
  ON public.billing_accounts FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Users can view own billing subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Users can view own billing subscriptions"
  ON public.billing_subscriptions FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

DROP POLICY IF EXISTS "Platform console can manage billing subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Platform console can manage billing subscriptions"
  ON public.billing_subscriptions FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Users can view own billing payments" ON public.billing_payments;
CREATE POLICY "Users can view own billing payments"
  ON public.billing_payments FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

DROP POLICY IF EXISTS "Platform console can manage billing payments" ON public.billing_payments;
CREATE POLICY "Platform console can manage billing payments"
  ON public.billing_payments FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

DROP POLICY IF EXISTS "Users can view own billing events" ON public.billing_events;
CREATE POLICY "Users can view own billing events"
  ON public.billing_events FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

DROP POLICY IF EXISTS "Platform console can manage billing events" ON public.billing_events;
CREATE POLICY "Platform console can manage billing events"
  ON public.billing_events FOR ALL TO authenticated
  USING (public.can_view_platform_console(auth.uid()))
  WITH CHECK (public.can_view_platform_console(auth.uid()));

-- 4. Helpers to keep canonical tables synchronized from legacy writes
CREATE OR REPLACE FUNCTION public.ensure_billing_account(p_school_id BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
BEGIN
  INSERT INTO public.billing_accounts (
    school_id,
    account_status,
    collection_status,
    billing_email,
    currency,
    country,
    metadata
  )
  SELECT
    s.id,
    CASE
      WHEN COALESCE(s.active, TRUE) = FALSE THEN 'suspended'
      WHEN COALESCE(s.subscription_status, 'active') = 'trial' THEN 'trial_active'
      WHEN COALESCE(s.subscription_status, 'active') = 'trial_expiring' THEN 'trial_expiring'
      WHEN COALESCE(s.subscription_status, 'active') = 'expired' THEN 'payment_pending'
      WHEN EXISTS (
        SELECT 1
        FROM public.saas_invoices i
        WHERE i.school_id = s.id
          AND i.status = 'overdue'
      ) THEN 'past_due'
      ELSE 'active'
    END,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.saas_invoices i
        WHERE i.school_id = s.id
          AND i.status = 'overdue'
      ) THEN 'grace'
      WHEN EXISTS (
        SELECT 1
        FROM public.saas_invoices i
        WHERE i.school_id = s.id
          AND i.status IN ('draft', 'sent')
      ) THEN 'upcoming_reminder'
      ELSE 'none'
    END,
    COALESCE(ss.billing_email_address, s.email),
    COALESCE(ss.currency, 'KES'),
    COALESCE(s.country, 'Kenya'),
    jsonb_build_object('source', 'phase1_backfill')
  FROM public.schools_school s
  LEFT JOIN public.school_settings ss ON ss.school_id = s.id
  WHERE s.id = p_school_id
  ON CONFLICT (school_id) DO UPDATE
  SET
    account_status = EXCLUDED.account_status,
    collection_status = EXCLUDED.collection_status,
    billing_email = EXCLUDED.billing_email,
    currency = EXCLUDED.currency,
    country = EXCLUDED.country,
    updated_at = NOW()
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_school_billing_projection(p_school_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school RECORD;
  v_account_id BIGINT;
  v_current_id BIGINT;
  v_plan RECORD;
  v_cycle TEXT := 'annual';
BEGIN
  SELECT * INTO v_school
  FROM public.schools_school
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_account_id := public.ensure_billing_account(p_school_id);

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE LOWER(name) = LOWER(COALESCE(v_school.subscription_plan, 'starter'))
  LIMIT 1;

  IF COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN
    v_cycle := 'trial';
  END IF;

  SELECT id INTO v_current_id
  FROM public.billing_subscriptions
  WHERE billing_account_id = v_account_id
    AND is_current = TRUE
  ORDER BY updated_at DESC, id DESC
  LIMIT 1;

  IF v_current_id IS NULL THEN
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
      price_snapshot,
      created_from,
      is_current,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_account_id,
      v_school.id,
      v_plan.id,
      COALESCE(v_school.subscription_plan, 'starter'),
      CASE
        WHEN COALESCE(v_school.subscription_status, 'active') = 'trial' THEN 'trial_active'
        WHEN COALESCE(v_school.subscription_status, 'active') = 'trial_expiring' THEN 'trial_expiring'
        WHEN COALESCE(v_school.subscription_status, 'active') = 'expired' THEN 'expired'
        WHEN COALESCE(v_school.active, TRUE) = FALSE THEN 'suspended'
        ELSE COALESCE(v_school.subscription_status, 'active')
      END,
      v_cycle,
      COALESCE(v_school.subscription_start, v_school.created_at, NOW()),
      v_school.subscription_end,
      CASE WHEN COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN COALESCE(v_school.subscription_start, v_school.created_at, NOW()) END,
      CASE WHEN COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN v_school.subscription_end END,
      jsonb_strip_nulls(jsonb_build_object(
        'plan_id', v_plan.id,
        'monthly_price', v_plan.monthly_price,
        'yearly_price', v_plan.yearly_price,
        'features', v_plan.features,
        'max_students', v_plan.max_students,
        'max_users', v_plan.max_users
      )),
      'school_projection',
      TRUE,
      jsonb_build_object('source', 'schools_school'),
      COALESCE(v_school.created_at, NOW()),
      NOW()
    );
  ELSE
    UPDATE public.billing_subscriptions
    SET
      plan_id = v_plan.id,
      plan_name = COALESCE(v_school.subscription_plan, 'starter'),
      subscription_status = CASE
        WHEN COALESCE(v_school.subscription_status, 'active') = 'trial' THEN 'trial_active'
        WHEN COALESCE(v_school.subscription_status, 'active') = 'trial_expiring' THEN 'trial_expiring'
        WHEN COALESCE(v_school.subscription_status, 'active') = 'expired' THEN 'expired'
        WHEN COALESCE(v_school.active, TRUE) = FALSE THEN 'suspended'
        ELSE COALESCE(v_school.subscription_status, 'active')
      END,
      billing_cycle = CASE
        WHEN COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN 'trial'
        ELSE COALESCE(billing_cycle, 'annual')
      END,
      term_start = COALESCE(v_school.subscription_start, term_start, v_school.created_at, NOW()),
      term_end = COALESCE(v_school.subscription_end, term_end),
      trial_starts_at = CASE WHEN COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN COALESCE(v_school.subscription_start, trial_starts_at, v_school.created_at, NOW()) ELSE trial_starts_at END,
      trial_ends_at = CASE WHEN COALESCE(v_school.subscription_status, '') LIKE 'trial%' THEN COALESCE(v_school.subscription_end, trial_ends_at) ELSE trial_ends_at END,
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('source', 'schools_school')
    WHERE id = v_current_id;
  END IF;

  UPDATE public.billing_accounts
  SET updated_at = NOW()
  WHERE id = v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_school_billing_projection_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sync_school_billing_projection(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_legacy_subscription_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_plan RECORD;
  v_existing_id BIGINT;
  v_other_latest TIMESTAMPTZ;
  v_this_latest TIMESTAMPTZ;
  v_should_be_current BOOLEAN := FALSE;
BEGIN
  v_account_id := public.ensure_billing_account(NEW.school_id);

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE LOWER(name) = LOWER(COALESCE(NEW.plan_name, 'starter'))
  LIMIT 1;

  v_this_latest := COALESCE(NEW.end_date, NEW.start_date, NOW());

  SELECT MAX(COALESCE(term_end, term_start, NOW())) INTO v_other_latest
  FROM public.billing_subscriptions
  WHERE billing_account_id = v_account_id
    AND (legacy_subscription_id IS DISTINCT FROM NEW.id);

  v_should_be_current := v_other_latest IS NULL OR v_this_latest >= v_other_latest;

  IF v_should_be_current THEN
    UPDATE public.billing_subscriptions
    SET is_current = FALSE,
        updated_at = NOW()
    WHERE billing_account_id = v_account_id
      AND legacy_subscription_id IS DISTINCT FROM NEW.id
      AND is_current = TRUE;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.billing_subscriptions
  WHERE legacy_subscription_id = NEW.id
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.billing_subscriptions (
      billing_account_id,
      school_id,
      legacy_subscription_id,
      plan_id,
      plan_name,
      subscription_status,
      billing_cycle,
      term_start,
      term_end,
      trial_starts_at,
      trial_ends_at,
      price_snapshot,
      created_from,
      is_current,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      v_account_id,
      NEW.school_id,
      NEW.id,
      v_plan.id,
      COALESCE(NEW.plan_name, 'starter'),
      CASE
        WHEN COALESCE(NEW.status, 'active') = 'trial' THEN 'trial_active'
        WHEN COALESCE(NEW.status, 'active') = 'trial_expiring' THEN 'trial_expiring'
        WHEN COALESCE(NEW.status, 'active') = 'expired' THEN 'expired'
        ELSE COALESCE(NEW.status, 'active')
      END,
      CASE
        WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN 'trial'
        WHEN COALESCE(NEW.billing_cycle, '') IN ('monthly', 'quarterly', 'annual', 'one_time', 'manual') THEN NEW.billing_cycle
        ELSE 'annual'
      END,
      COALESCE(NEW.start_date, NOW()),
      NEW.end_date,
      CASE WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN COALESCE(NEW.start_date, NOW()) END,
      CASE WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN NEW.end_date END,
      jsonb_strip_nulls(jsonb_build_object(
        'amount', NEW.amount,
        'payment_reference', NULLIF(NEW.payment_reference, ''),
        'plan_id', v_plan.id,
        'monthly_price', v_plan.monthly_price,
        'yearly_price', v_plan.yearly_price
      )),
      'legacy_subscriptions',
      v_should_be_current,
      jsonb_build_object('source', 'subscriptions'),
      COALESCE(NEW.created_at, NOW()),
      NOW()
    );
  ELSE
    UPDATE public.billing_subscriptions
    SET
      plan_id = v_plan.id,
      plan_name = COALESCE(NEW.plan_name, 'starter'),
      subscription_status = CASE
        WHEN COALESCE(NEW.status, 'active') = 'trial' THEN 'trial_active'
        WHEN COALESCE(NEW.status, 'active') = 'trial_expiring' THEN 'trial_expiring'
        WHEN COALESCE(NEW.status, 'active') = 'expired' THEN 'expired'
        ELSE COALESCE(NEW.status, 'active')
      END,
      billing_cycle = CASE
        WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN 'trial'
        WHEN COALESCE(NEW.billing_cycle, '') IN ('monthly', 'quarterly', 'annual', 'one_time', 'manual') THEN NEW.billing_cycle
        ELSE billing_cycle
      END,
      term_start = COALESCE(NEW.start_date, term_start),
      term_end = COALESCE(NEW.end_date, term_end),
      trial_starts_at = CASE WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN COALESCE(NEW.start_date, trial_starts_at) ELSE trial_starts_at END,
      trial_ends_at = CASE WHEN COALESCE(NEW.status, '') LIKE 'trial%' THEN COALESCE(NEW.end_date, trial_ends_at) ELSE trial_ends_at END,
      price_snapshot = COALESCE(price_snapshot, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'amount', NEW.amount,
        'payment_reference', NULLIF(NEW.payment_reference, '')
      )),
      is_current = CASE WHEN v_should_be_current THEN TRUE ELSE is_current END,
      updated_at = NOW()
    WHERE id = v_existing_id;
  END IF;

  PERFORM public.sync_school_billing_projection(NEW.school_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_invoice_compat_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_currency TEXT;
BEGIN
  v_account_id := public.ensure_billing_account(NEW.school_id);

  IF NEW.billing_account_id IS NULL THEN
    NEW.billing_account_id := v_account_id;
  END IF;

  IF NEW.billing_subscription_id IS NULL THEN
    SELECT id INTO NEW.billing_subscription_id
    FROM public.billing_subscriptions
    WHERE school_id = NEW.school_id
      AND is_current = TRUE
    ORDER BY updated_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF NEW.invoice_type IS NULL OR NEW.invoice_type = 'subscription' THEN
    NEW.invoice_type := CASE
      WHEN NEW.invoice_number LIKE 'REN-%' THEN 'subscription_renewal'
      WHEN LOWER(COALESCE(NEW.items::TEXT, '')) LIKE '%onboarding%' THEN 'onboarding'
      WHEN LOWER(COALESCE(NEW.items::TEXT, '')) LIKE '%credit%' THEN 'credit_note'
      ELSE COALESCE(NEW.invoice_type, 'subscription')
    END;
  END IF;

  SELECT COALESCE(ss.currency, 'KES') INTO v_currency
  FROM public.schools_school s
  LEFT JOIN public.school_settings ss ON ss.school_id = s.id
  WHERE s.id = NEW.school_id;

  NEW.currency := COALESCE(NULLIF(NEW.currency, ''), v_currency, 'KES');
  NEW.subtotal := COALESCE(NEW.subtotal, NEW.amount);
  NEW.tax_amount := COALESCE(NEW.tax_amount, 0);
  NEW.total_amount := COALESCE(NEW.total_amount, NEW.subtotal + NEW.tax_amount, NEW.amount);
  NEW.balance_due := CASE
    WHEN NEW.status = 'paid' THEN 0
    ELSE COALESCE(NEW.balance_due, NEW.total_amount, NEW.amount)
  END;
  NEW.issued_at := CASE
    WHEN NEW.status <> 'draft' THEN COALESCE(NEW.issued_at, NEW.created_at, NOW())
    ELSE NEW.issued_at
  END;
  NEW.delivered_at := CASE
    WHEN NEW.status IN ('sent', 'paid', 'overdue') THEN COALESCE(NEW.delivered_at, NEW.issued_at, NEW.created_at, NOW())
    ELSE NEW.delivered_at
  END;
  NEW.collection_stage := CASE
    WHEN NEW.status = 'overdue' THEN 'grace'
    WHEN NEW.status = 'sent' THEN COALESCE(NULLIF(NEW.collection_stage, 'none'), 'first_reminder')
    WHEN NEW.status = 'paid' THEN 'none'
    WHEN NEW.status = 'void' THEN 'none'
    ELSE COALESCE(NEW.collection_stage, 'none')
  END;
  NEW.next_follow_up_at := CASE
    WHEN NEW.status = 'sent' AND NEW.next_follow_up_at IS NULL THEN COALESCE(NEW.due_date::TIMESTAMPTZ, NEW.created_at, NOW())
    WHEN NEW.status = 'overdue' AND NEW.next_follow_up_at IS NULL THEN COALESCE(NEW.updated_at, NEW.created_at, NOW()) + INTERVAL '3 days'
    ELSE NEW.next_follow_up_at
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_invoice_payment_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_id BIGINT;
  v_method TEXT;
  v_reference TEXT;
  v_payment_id BIGINT;
BEGIN
  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_payments
    WHERE invoice_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_account_id := COALESCE(NEW.billing_account_id, public.ensure_billing_account(NEW.school_id));

  SELECT COALESCE(
           NULLIF(NEW.items #>> '{payment_info,method}', ''),
           (
             SELECT elem -> 'payment_info' ->> 'method'
             FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) elem
             WHERE elem ? 'payment_info'
             LIMIT 1
           ),
           'Manual'
         ),
         COALESCE(
           NULLIF(NEW.items #>> '{payment_info,ref}', ''),
           (
             SELECT elem -> 'payment_info' ->> 'ref'
             FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) elem
             WHERE elem ? 'payment_info'
             LIMIT 1
           )
         )
  INTO v_method, v_reference;

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
    reconciliation_status,
    notes,
    metadata
  ) VALUES (
    v_account_id,
    NEW.school_id,
    NEW.id,
    COALESCE(NEW.total_amount, NEW.amount),
    COALESCE(NEW.currency, 'KES'),
    COALESCE(v_method, 'Manual'),
    v_reference,
    'manual',
    COALESCE(NEW.paid_at, NOW()),
    'recorded',
    'Mirrored from legacy invoice payment record',
    jsonb_build_object('source', 'saas_invoices')
  ) RETURNING id INTO v_payment_id;

  INSERT INTO public.billing_events (
    billing_account_id,
    school_id,
    invoice_id,
    payment_id,
    event_type,
    event_payload,
    occurred_at
  ) VALUES (
    v_account_id,
    NEW.school_id,
    NEW.id,
    v_payment_id,
    'payment.recorded',
    jsonb_build_object('source', 'legacy_invoice_payment', 'amount', COALESCE(NEW.total_amount, NEW.amount)),
    COALESCE(NEW.paid_at, NOW())
  );

  RETURN NEW;
END;
$$;

-- 5. Backfill canonical billing tables from current data
INSERT INTO public.billing_accounts (
  school_id,
  account_status,
  collection_status,
  billing_email,
  currency,
  country,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.id,
  CASE
    WHEN COALESCE(s.active, TRUE) = FALSE THEN 'suspended'
    WHEN COALESCE(s.subscription_status, 'active') = 'trial' THEN 'trial_active'
    WHEN COALESCE(s.subscription_status, 'active') = 'trial_expiring' THEN 'trial_expiring'
    WHEN COALESCE(s.subscription_status, 'active') = 'expired' THEN 'payment_pending'
    WHEN EXISTS (
      SELECT 1 FROM public.saas_invoices i WHERE i.school_id = s.id AND i.status = 'overdue'
    ) THEN 'past_due'
    ELSE 'active'
  END,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.saas_invoices i WHERE i.school_id = s.id AND i.status = 'overdue'
    ) THEN 'grace'
    WHEN EXISTS (
      SELECT 1 FROM public.saas_invoices i WHERE i.school_id = s.id AND i.status IN ('draft', 'sent')
    ) THEN 'upcoming_reminder'
    ELSE 'none'
  END,
  COALESCE(ss.billing_email_address, s.email),
  COALESCE(ss.currency, 'KES'),
  COALESCE(s.country, 'Kenya'),
  jsonb_build_object('source', 'phase1_backfill'),
  COALESCE(s.created_at, NOW()),
  NOW()
FROM public.schools_school s
LEFT JOIN public.school_settings ss ON ss.school_id = s.id
ON CONFLICT (school_id) DO NOTHING;

WITH ranked_subscriptions AS (
  SELECT
    subs.*,
    ba.id AS billing_account_id,
    sp.id AS plan_id,
    sp.monthly_price,
    sp.yearly_price,
    ROW_NUMBER() OVER (
      PARTITION BY subs.school_id
      ORDER BY COALESCE(subs.end_date, subs.start_date, subs.created_at, NOW()) DESC, subs.created_at DESC, subs.id DESC
    ) AS ranking
  FROM public.subscriptions subs
  JOIN public.billing_accounts ba ON ba.school_id = subs.school_id
  LEFT JOIN public.subscription_plans sp ON LOWER(sp.name) = LOWER(COALESCE(subs.plan_name, 'starter'))
)
INSERT INTO public.billing_subscriptions (
  billing_account_id,
  school_id,
  legacy_subscription_id,
  plan_id,
  plan_name,
  subscription_status,
  billing_cycle,
  term_start,
  term_end,
  trial_starts_at,
  trial_ends_at,
  price_snapshot,
  created_from,
  is_current,
  metadata,
  created_at,
  updated_at
)
SELECT
  rs.billing_account_id,
  rs.school_id,
  rs.id,
  rs.plan_id,
  COALESCE(rs.plan_name, 'starter'),
  CASE
    WHEN COALESCE(rs.status, 'active') = 'trial' THEN 'trial_active'
    WHEN COALESCE(rs.status, 'active') = 'trial_expiring' THEN 'trial_expiring'
    WHEN COALESCE(rs.status, 'active') = 'expired' THEN 'expired'
    ELSE COALESCE(rs.status, 'active')
  END,
  CASE
    WHEN COALESCE(rs.status, '') LIKE 'trial%' THEN 'trial'
    WHEN COALESCE(rs.billing_cycle, '') IN ('monthly', 'quarterly', 'annual', 'one_time', 'manual') THEN rs.billing_cycle
    ELSE 'annual'
  END,
  COALESCE(rs.start_date, NOW()),
  rs.end_date,
  CASE WHEN COALESCE(rs.status, '') LIKE 'trial%' THEN COALESCE(rs.start_date, NOW()) END,
  CASE WHEN COALESCE(rs.status, '') LIKE 'trial%' THEN rs.end_date END,
  jsonb_strip_nulls(jsonb_build_object(
    'amount', rs.amount,
    'payment_reference', NULLIF(rs.payment_reference, ''),
    'plan_id', rs.plan_id,
    'monthly_price', rs.monthly_price,
    'yearly_price', rs.yearly_price
  )),
  'legacy_subscriptions',
  rs.ranking = 1,
  jsonb_build_object('source', 'subscriptions'),
  COALESCE(rs.created_at, NOW()),
  COALESCE(rs.updated_at, NOW())
FROM ranked_subscriptions rs
WHERE NOT EXISTS (
  SELECT 1
  FROM public.billing_subscriptions bs
  WHERE bs.legacy_subscription_id = rs.id
);

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
  price_snapshot,
  created_from,
  is_current,
  metadata,
  created_at,
  updated_at
)
SELECT
  ba.id,
  s.id,
  sp.id,
  COALESCE(s.subscription_plan, 'starter'),
  CASE
    WHEN COALESCE(s.subscription_status, 'active') = 'trial' THEN 'trial_active'
    WHEN COALESCE(s.subscription_status, 'active') = 'trial_expiring' THEN 'trial_expiring'
    WHEN COALESCE(s.subscription_status, 'active') = 'expired' THEN 'expired'
    WHEN COALESCE(s.active, TRUE) = FALSE THEN 'suspended'
    ELSE COALESCE(s.subscription_status, 'active')
  END,
  CASE
    WHEN COALESCE(s.subscription_status, '') LIKE 'trial%' THEN 'trial'
    ELSE 'annual'
  END,
  COALESCE(s.subscription_start, s.created_at, NOW()),
  s.subscription_end,
  CASE WHEN COALESCE(s.subscription_status, '') LIKE 'trial%' THEN COALESCE(s.subscription_start, s.created_at, NOW()) END,
  CASE WHEN COALESCE(s.subscription_status, '') LIKE 'trial%' THEN s.subscription_end END,
  jsonb_strip_nulls(jsonb_build_object(
    'plan_id', sp.id,
    'monthly_price', sp.monthly_price,
    'yearly_price', sp.yearly_price,
    'features', sp.features,
    'max_students', sp.max_students,
    'max_users', sp.max_users
  )),
  'school_projection',
  TRUE,
  jsonb_build_object('source', 'schools_school'),
  COALESCE(s.created_at, NOW()),
  NOW()
FROM public.schools_school s
JOIN public.billing_accounts ba ON ba.school_id = s.id
LEFT JOIN public.subscription_plans sp ON LOWER(sp.name) = LOWER(COALESCE(s.subscription_plan, 'starter'))
WHERE NOT EXISTS (
  SELECT 1
  FROM public.billing_subscriptions bs
  WHERE bs.school_id = s.id
);

UPDATE public.saas_invoices i
SET
  billing_account_id = ba.id,
  billing_subscription_id = COALESCE(
    i.billing_subscription_id,
    (
      SELECT bs.id
      FROM public.billing_subscriptions bs
      WHERE bs.school_id = i.school_id
        AND bs.is_current = TRUE
      ORDER BY bs.updated_at DESC, bs.id DESC
      LIMIT 1
    )
  ),
  invoice_type = CASE
    WHEN i.invoice_number LIKE 'REN-%' THEN 'subscription_renewal'
    WHEN LOWER(COALESCE(i.items::TEXT, '')) LIKE '%onboarding%' THEN 'onboarding'
    WHEN LOWER(COALESCE(i.items::TEXT, '')) LIKE '%credit%' THEN 'credit_note'
    ELSE COALESCE(i.invoice_type, 'subscription')
  END,
  currency = COALESCE(ss.currency, 'KES'),
  subtotal = COALESCE(i.subtotal, i.amount),
  tax_amount = COALESCE(i.tax_amount, 0),
  total_amount = COALESCE(i.total_amount, i.amount),
  balance_due = CASE
    WHEN i.status = 'paid' THEN 0
    ELSE COALESCE(i.balance_due, i.total_amount, i.amount)
  END,
  issued_at = COALESCE(i.issued_at, CASE WHEN i.status <> 'draft' THEN i.created_at END),
  delivered_at = COALESCE(i.delivered_at, CASE WHEN i.status IN ('sent', 'paid', 'overdue') THEN i.created_at END),
  collection_stage = CASE
    WHEN i.status = 'overdue' THEN 'grace'
    WHEN i.status = 'sent' THEN 'first_reminder'
    ELSE COALESCE(i.collection_stage, 'none')
  END,
  next_follow_up_at = COALESCE(
    i.next_follow_up_at,
    CASE
      WHEN i.status = 'sent' THEN COALESCE(i.due_date::TIMESTAMPTZ, i.created_at, NOW())
      WHEN i.status = 'overdue' THEN COALESCE(i.updated_at, i.created_at, NOW()) + INTERVAL '3 days'
      ELSE NULL
    END
  ),
  metadata = COALESCE(i.metadata, '{}'::jsonb) || jsonb_build_object('source', 'phase1_backfill')
FROM public.billing_accounts ba
LEFT JOIN public.school_settings ss ON ss.school_id = ba.school_id
WHERE ba.school_id = i.school_id;

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
  reconciliation_status,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT
  i.billing_account_id,
  i.school_id,
  i.id,
  COALESCE(i.total_amount, i.amount),
  COALESCE(i.currency, 'KES'),
  COALESCE(
    NULLIF(i.items #>> '{payment_info,method}', ''),
    (
      SELECT elem -> 'payment_info' ->> 'method'
      FROM jsonb_array_elements(COALESCE(i.items, '[]'::jsonb)) elem
      WHERE elem ? 'payment_info'
      LIMIT 1
    ),
    'Manual'
  ),
  COALESCE(
    NULLIF(i.items #>> '{payment_info,ref}', ''),
    (
      SELECT elem -> 'payment_info' ->> 'ref'
      FROM jsonb_array_elements(COALESCE(i.items, '[]'::jsonb)) elem
      WHERE elem ? 'payment_info'
      LIMIT 1
    )
  ),
  'manual',
  COALESCE(i.paid_at, i.updated_at, i.created_at, NOW()),
  'recorded',
  'Backfilled from paid invoice',
  jsonb_build_object('source', 'saas_invoices'),
  COALESCE(i.paid_at, i.updated_at, i.created_at, NOW()),
  NOW()
FROM public.saas_invoices i
WHERE i.status = 'paid'
  AND i.billing_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.billing_payments bp
    WHERE bp.invoice_id = i.id
  );

INSERT INTO public.billing_events (
  billing_account_id,
  school_id,
  event_type,
  event_payload,
  occurred_at
)
SELECT
  ba.id,
  ba.school_id,
  'billing.account_backfilled',
  jsonb_build_object('account_status', ba.account_status, 'collection_status', ba.collection_status),
  ba.created_at
FROM public.billing_accounts ba
WHERE NOT EXISTS (
  SELECT 1
  FROM public.billing_events be
  WHERE be.billing_account_id = ba.id
    AND be.event_type = 'billing.account_backfilled'
);

INSERT INTO public.billing_events (
  billing_account_id,
  billing_subscription_id,
  school_id,
  event_type,
  event_payload,
  occurred_at
)
SELECT
  bs.billing_account_id,
  bs.id,
  bs.school_id,
  'billing.subscription_backfilled',
  jsonb_build_object('plan_name', bs.plan_name, 'subscription_status', bs.subscription_status),
  bs.created_at
FROM public.billing_subscriptions bs
WHERE NOT EXISTS (
  SELECT 1
  FROM public.billing_events be
  WHERE be.billing_subscription_id = bs.id
    AND be.event_type = 'billing.subscription_backfilled'
);

INSERT INTO public.billing_events (
  billing_account_id,
  school_id,
  invoice_id,
  event_type,
  event_payload,
  occurred_at
)
SELECT
  i.billing_account_id,
  i.school_id,
  i.id,
  'billing.invoice_backfilled',
  jsonb_build_object('status', i.status, 'invoice_type', i.invoice_type, 'balance_due', i.balance_due),
  COALESCE(i.issued_at, i.created_at)
FROM public.saas_invoices i
WHERE i.billing_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.billing_events be
    WHERE be.invoice_id = i.id
      AND be.event_type = 'billing.invoice_backfilled'
  );

INSERT INTO public.billing_events (
  billing_account_id,
  school_id,
  invoice_id,
  payment_id,
  event_type,
  event_payload,
  occurred_at
)
SELECT
  bp.billing_account_id,
  bp.school_id,
  bp.invoice_id,
  bp.id,
  'billing.payment_backfilled',
  jsonb_build_object('amount', bp.amount, 'payment_method', bp.payment_method),
  bp.received_at
FROM public.billing_payments bp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.billing_events be
  WHERE be.payment_id = bp.id
    AND be.event_type = 'billing.payment_backfilled'
);

DO $$
DECLARE
  v_school_id BIGINT;
BEGIN
  FOR v_school_id IN SELECT id FROM public.schools_school LOOP
    PERFORM public.sync_school_billing_projection(v_school_id);
  END LOOP;
END;
$$;

-- 6. Compatibility read model and snapshot function
CREATE OR REPLACE VIEW public.billing_account_snapshot_v1 AS
SELECT
  ba.id AS billing_account_id,
  ba.school_id,
  s.name::TEXT AS school_name,
  ba.account_status,
  ba.collection_status,
  ba.billing_email,
  ba.currency,
  ba.country,
  bs.id AS billing_subscription_id,
  bs.plan_name AS current_plan,
  bs.subscription_status,
  bs.billing_cycle,
  bs.term_start,
  bs.term_end,
  bs.trial_starts_at,
  bs.trial_ends_at,
  bs.grace_ends_at,
  COALESCE(metrics.open_invoice_count, 0)::BIGINT AS open_invoice_count,
  COALESCE(metrics.overdue_invoice_count, 0)::BIGINT AS overdue_invoice_count,
  COALESCE(metrics.outstanding_balance, 0)::DECIMAL(12,2) AS outstanding_balance,
  last_invoice.id AS last_invoice_id,
  last_invoice.status AS last_invoice_status,
  last_invoice.next_follow_up_at
FROM public.billing_accounts ba
JOIN public.schools_school s ON s.id = ba.school_id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.billing_subscriptions bs
  WHERE bs.billing_account_id = ba.id
    AND bs.is_current = TRUE
  ORDER BY bs.updated_at DESC, bs.id DESC
  LIMIT 1
) bs ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE i.status IN ('draft', 'sent', 'overdue')) AS open_invoice_count,
    COUNT(*) FILTER (WHERE i.status = 'overdue') AS overdue_invoice_count,
    COALESCE(SUM(CASE WHEN i.status = 'paid' THEN 0 ELSE COALESCE(i.balance_due, i.total_amount, i.amount) END), 0) AS outstanding_balance
  FROM public.saas_invoices i
  WHERE i.billing_account_id = ba.id
) metrics ON TRUE
LEFT JOIN LATERAL (
  SELECT i.id, i.status, i.next_follow_up_at
  FROM public.saas_invoices i
  WHERE i.billing_account_id = ba.id
  ORDER BY i.created_at DESC, i.id DESC
  LIMIT 1
) last_invoice ON TRUE;

CREATE OR REPLACE FUNCTION public.get_billing_account_snapshot(p_school_id BIGINT DEFAULT NULL)
RETURNS TABLE (
  billing_account_id BIGINT,
  school_id BIGINT,
  school_name TEXT,
  account_status TEXT,
  collection_status TEXT,
  billing_email TEXT,
  currency TEXT,
  country TEXT,
  billing_subscription_id BIGINT,
  current_plan TEXT,
  subscription_status TEXT,
  billing_cycle TEXT,
  term_start TIMESTAMPTZ,
  term_end TIMESTAMPTZ,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  open_invoice_count BIGINT,
  overdue_invoice_count BIGINT,
  outstanding_balance DECIMAL(12,2),
  last_invoice_id BIGINT,
  last_invoice_status TEXT,
  next_follow_up_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT := COALESCE(p_school_id, public.get_user_school_id());
BEGIN
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  IF NOT (public.can_view_platform_console(auth.uid()) OR public.get_user_school_id() = v_school_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.billing_account_snapshot_v1 bas
  WHERE bas.school_id = v_school_id;
END;
$$;

-- 7. Keep legacy-compatible access checks reading from canonical snapshot when available
CREATE OR REPLACE FUNCTION public.check_subscription_status()
RETURNS TABLE(
  is_valid BOOLEAN,
  plan TEXT,
  status TEXT,
  days_remaining INTEGER,
  school_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id BIGINT;
BEGIN
  SELECT u.school_id INTO v_school_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();

  IF v_school_id IS NULL THEN
    RETURN QUERY SELECT FALSE, ''::TEXT, 'no_school'::TEXT, 0, ''::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_account_snapshot_v1 bas
    WHERE bas.school_id = v_school_id
  ) THEN
    RETURN QUERY
    SELECT
      (bas.account_status IN ('trial_active', 'trial_expiring', 'active', 'renewal_due', 'grace_period'))::BOOLEAN AS is_valid,
      COALESCE(bas.current_plan, 'starter')::TEXT AS plan,
      COALESCE(bas.subscription_status, bas.account_status, 'inactive')::TEXT AS status,
      CASE
        WHEN bas.grace_ends_at IS NOT NULL AND bas.account_status = 'grace_period'
          THEN GREATEST(0, EXTRACT(DAY FROM bas.grace_ends_at - NOW())::INTEGER)
        WHEN bas.term_end IS NOT NULL
          THEN GREATEST(0, EXTRACT(DAY FROM bas.term_end - NOW())::INTEGER)
        WHEN bas.trial_ends_at IS NOT NULL
          THEN GREATEST(0, EXTRACT(DAY FROM bas.trial_ends_at - NOW())::INTEGER)
        ELSE 999
      END AS days_remaining,
      bas.school_name::TEXT
    FROM public.billing_account_snapshot_v1 bas
    WHERE bas.school_id = v_school_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    (s.active = TRUE AND s.subscription_status IN ('active', 'trial'))::BOOLEAN AS is_valid,
    COALESCE(s.subscription_plan, 'starter')::TEXT AS plan,
    COALESCE(s.subscription_status, 'inactive')::TEXT AS status,
    CASE
      WHEN s.subscription_end IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM s.subscription_end - NOW())::INTEGER)
      ELSE 999
    END AS days_remaining,
    s.name::TEXT AS school_name
  FROM public.schools_school s
  WHERE s.id = v_school_id;
END;
$$;

-- 8. Triggers installed after backfill to mirror legacy writes forward
DROP TRIGGER IF EXISTS trg_school_billing_projection_sync ON public.schools_school;
CREATE TRIGGER trg_school_billing_projection_sync
AFTER INSERT OR UPDATE OF subscription_plan, subscription_status, subscription_start, subscription_end, active, email, country
ON public.schools_school
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION public.handle_school_billing_projection_sync();

DROP TRIGGER IF EXISTS trg_legacy_subscription_sync ON public.subscriptions;
CREATE TRIGGER trg_legacy_subscription_sync
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION public.handle_legacy_subscription_sync();

DROP TRIGGER IF EXISTS trg_sync_invoice_compat_fields ON public.saas_invoices;
CREATE TRIGGER trg_sync_invoice_compat_fields
BEFORE INSERT OR UPDATE ON public.saas_invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_compat_fields();

DROP TRIGGER IF EXISTS trg_invoice_payment_sync ON public.saas_invoices;
CREATE TRIGGER trg_invoice_payment_sync
AFTER INSERT OR UPDATE OF status, paid_at ON public.saas_invoices
FOR EACH ROW
WHEN (pg_trigger_depth() = 0)
EXECUTE FUNCTION public.handle_invoice_payment_sync();