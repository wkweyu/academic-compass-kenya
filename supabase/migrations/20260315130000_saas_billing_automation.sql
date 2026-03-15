-- Automation for SaaS billing and invoicing logic

-- 1. Function to mark overdue invoices
CREATE OR REPLACE FUNCTION public.process_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Only allowed for platform admins (handled via security definer if called by cron)
  -- If called via UI, check permissions
  IF auth.uid() IS NOT NULL AND NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.saas_invoices
  SET status = 'overdue',
      updated_at = NOW()
  WHERE status IN ('draft', 'sent')
    AND due_date < CURRENT_DATE
    AND paid_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the activity
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

-- 2. Function to auto-generate renewal invoices for active subscriptions
-- This looks for schools whose subscription ends within 7 days AND don't have a pending/paid invoice for the next period
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
DECLARE
  v_row RECORD;
  v_new_invoice_id BIGINT;
  v_invoice_num TEXT;
  v_plan_price DECIMAL;
  v_plan_display TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  FOR v_row IN 
    SELECT 
      s.id, 
      s.name, 
      s.subscription_plan, 
      s.subscription_end,
      p.yearly_price,
      p.display_name
    FROM public.schools_school s
    JOIN public.subscription_plans p ON LOWER(s.subscription_plan) = LOWER(p.name)
    WHERE s.active = TRUE
      AND s.subscription_status = 'active'
      AND s.subscription_end <= (CURRENT_DATE + INTERVAL '10 days')
      AND s.subscription_end >= CURRENT_DATE
      -- Ensure no recent pending/paid invoice exists for this school (last 30 days)
      AND NOT EXISTS (
        SELECT 1 FROM public.saas_invoices i 
        WHERE i.school_id = s.id 
          AND i.created_at > (NOW() - INTERVAL '30 days')
          AND i.status IN ('draft', 'sent', 'paid')
      )
  LOOP
    v_invoice_num := 'REN-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(v_row.id::TEXT, 5, '0');
    
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
      v_row.id,
      v_invoice_num,
      v_row.yearly_price,
      'draft',
      v_row.subscription_end, -- Due on expiry
      v_row.subscription_end, -- New period starts when old ends
      v_row.subscription_end + INTERVAL '1 year', -- Standard 1 year renewal
      jsonb_build_array(
        jsonb_build_object(
          'description', 'Annual Subscription Renewal - ' || v_row.display_name,
          'amount', v_row.yearly_price,
          'qty', 1
        )
      )
    ) RETURNING id INTO v_new_invoice_id;

    -- Log communication
    INSERT INTO public.saas_communications (
      school_id, 
      subject, 
      content, 
      category, 
      type, 
      status
    ) VALUES (
      v_row.id,
      'Renewal Invoice Generated: ' || v_invoice_num,
      'A draft renewal invoice for KES ' || v_row.yearly_price || ' has been generated for ' || v_row.name,
      'billing',
      'system_notification',
      'pending'
    );

    school_id := v_row.id;
    invoice_id := v_new_invoice_id;
    amount := v_row.yearly_price;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3. Function to record payment and extend subscription automatically
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
DECLARE
  v_invoice RECORD;
  v_school RECORD;
  v_new_end DATE;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_invoice FROM public.saas_invoices WHERE id = p_invoice_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN; -- Already paid
  END IF;

  UPDATE public.saas_invoices
  SET status = 'paid',
      paid_at = NOW(),
      updated_at = NOW(),
      items = items || jsonb_build_object('payment_info', jsonb_build_object('method', p_payment_method, 'ref', p_reference))
  WHERE id = p_invoice_id;

  SELECT * INTO v_school FROM public.schools_school WHERE id = v_invoice.school_id FOR UPDATE;

  -- Logic to extend: if current expiry is in the future, add to it. If past, start from today.
  IF v_school.subscription_end > CURRENT_DATE THEN
    v_new_end := v_school.subscription_end + INTERVAL '1 year';
  ELSE
    v_new_end := CURRENT_DATE + INTERVAL '1 year';
  END IF;

  UPDATE public.schools_school
  SET subscription_end = v_new_end,
      subscription_status = 'active',
      active = TRUE
  WHERE id = v_invoice.school_id;

  -- Create a record in subscription history
  INSERT INTO public.subscriptions (
    school_id, plan_name, status, amount, start_date, end_date
  ) VALUES (
    v_invoice.school_id,
    v_school.subscription_plan,
    'active',
    v_invoice.amount,
    NOW(),
    v_new_end
  );

  -- Log communication
  INSERT INTO public.saas_communications (
    school_id, subject, content, category, type, status, sent_at
  ) VALUES (
    v_invoice.school_id,
    'Payment Received - Subscription Extended',
    'Payment for invoice ' || v_invoice.invoice_number || ' received. Subscription extended to ' || v_new_end,
    'billing',
    'system_notification',
    'sent',
    NOW()
  );
END;
$$;
