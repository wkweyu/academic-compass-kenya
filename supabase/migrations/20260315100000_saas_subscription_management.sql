-- Phase 1: Subscription Management & Communication Features

-- 1. Extend school_settings for communication preferences
ALTER TABLE public.school_settings
ADD COLUMN IF NOT EXISTS automated_billing_emails BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS billing_email_address TEXT,
ADD COLUMN IF NOT EXISTS subscription_renewal_reminder_days INTEGER DEFAULT 7;

-- 2. Create subscription_plans table for better management
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(12,2) NOT NULL,
  yearly_price DECIMAL(12,2) NOT NULL,
  max_students INTEGER NOT NULL,
  max_users INTEGER NOT NULL,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial plans
INSERT INTO public.subscription_plans (name, display_name, monthly_price, yearly_price, max_students, max_users, features)
VALUES 
('starter', 'Starter', 5000, 50000, 200, 10, '["basic_reporting", "attendance", "exams"]'),
('standard', 'Standard', 15000, 150000, 1000, 50, '["advanced_reporting", "billing", "inventory", "transport"]'),
('enterprise', 'Enterprise', 40000, 400000, 10000, 500, '["all_features", "api_access", "priority_support"]')
ON CONFLICT (name) DO NOTHING;

-- 3. Create invoices table
CREATE TABLE IF NOT EXISTS public.saas_invoices (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  billing_period_start DATE,
  billing_period_end DATE,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create communication_logs for SaaS tracking
CREATE TABLE IF NOT EXISTS public.saas_communications (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE CASCADE,
  recipient_email TEXT,
  subject TEXT,
  content TEXT,
  type TEXT NOT NULL DEFAULT 'email' CHECK (type IN ('email', 'sms', 'system_notification')),
  category TEXT NOT NULL CHECK (category IN ('billing', 'marketing', 'support', 'update')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS Policies
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can view plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins can manage plans" ON public.subscription_plans
  FOR ALL TO authenticated USING (public.can_view_platform_console(auth.uid()));

CREATE POLICY "Users can view own school invoices" ON public.saas_invoices
  FOR SELECT TO authenticated USING (school_id = public.get_user_school_id());

CREATE POLICY "Platform console can manage all invoices" ON public.saas_invoices
  FOR ALL TO authenticated USING (public.can_view_platform_console(auth.uid()));

CREATE POLICY "Platform console can view communications" ON public.saas_communications
  FOR SELECT TO authenticated USING (public.can_view_platform_console(auth.uid()));

-- 6. RPC Functions

-- Function to generate an invoice for a school
CREATE OR REPLACE FUNCTION public.generate_saas_invoice(
  p_school_id BIGINT,
  p_amount DECIMAL,
  p_due_date DATE,
  p_items JSONB,
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id BIGINT;
  v_invoice_num TEXT;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  INSERT INTO public.saas_invoices (
    school_id, 
    invoice_number, 
    amount, 
    status, 
    due_date, 
    billing_period_start, 
    billing_period_end, 
    items
  ) VALUES (
    p_school_id,
    v_invoice_num,
    p_amount,
    'draft',
    p_due_date,
    p_period_start,
    p_period_end,
    p_items
  ) RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

-- Function to record communication
CREATE OR REPLACE FUNCTION public.log_saas_communication(
  p_school_id BIGINT,
  p_recipient TEXT,
  p_subject TEXT,
  p_content TEXT,
  p_category TEXT,
  p_type TEXT DEFAULT 'email'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.saas_communications (
    school_id, recipient_email, subject, content, category, type
  ) VALUES (
    p_school_id, p_recipient, p_subject, p_content, p_category, p_type
  );
END;
$$;

-- Function to get school subscription history
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
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.can_view_platform_console(auth.uid()) OR public.get_user_school_id() = p_school_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT s.id, s.plan_name, s.status, s.amount, s.start_date, s.end_date, s.created_at
  FROM public.subscriptions s
  WHERE s.school_id = p_school_id
  ORDER BY s.created_at DESC;
END;
$$;

-- Function for background cron job (represented as RPC for now) to check for expiring subscriptions
CREATE OR REPLACE FUNCTION public.check_expiring_subscriptions()
RETURNS TABLE (
  school_id BIGINT,
  school_name TEXT,
  end_date DATE,
  days_left INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- This would typically be called by an Edge Function or Cron
  RETURN QUERY
  SELECT 
    s.id as school_id, 
    s.name as school_name, 
    s.subscription_end::DATE as end_date,
    (s.subscription_end::DATE - CURRENT_DATE)::INTEGER as days_left
  FROM public.schools_school s
  WHERE s.subscription_end IS NOT NULL 
    AND s.subscription_status = 'active'
    AND s.subscription_end <= (CURRENT_DATE + INTERVAL '7 days');
END;
$$;
