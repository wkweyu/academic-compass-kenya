-- Enhanced Audit Logging for SaaS Platform Events

-- 1. Function to log billing specific events
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
  SELECT school_id INTO v_school_id FROM public.saas_invoices WHERE id = p_invoice_id;

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

-- 2. Function to log portfolio specific events
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

-- 3. Update existing billing logic to use these enhanced logs
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
DECLARE
  v_invoice RECORD;
  v_school RECORD;
  v_new_end DATE;
  v_old_status TEXT;
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_invoice FROM public.saas_invoices WHERE id = p_invoice_id FOR UPDATE;
  v_old_status := v_invoice.status;
  
  -- Re-use original record_invoice_payment logic (calling the base version)
  PERFORM public.record_invoice_payment(p_invoice_id, p_payment_method, p_reference);

  -- Add enhanced audit log
  PERFORM public.log_saas_billing_event(
    p_invoice_id,
    'PAYMENT_RECORDED',
    jsonb_build_object('method', p_payment_method, 'reference', p_reference),
    v_old_status,
    'paid'
  );
END;
$$;
