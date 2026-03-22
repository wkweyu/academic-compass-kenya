-- Notification and Messaging Logic for SaaS Billing

-- 1. Helper to send/track a billing email (simulated for now, as Supabase Edge functions usually handle the actual SMTP)
CREATE OR REPLACE FUNCTION public.send_billing_notification(
  p_school_id BIGINT,
  p_invoice_id BIGINT,
  p_subject TEXT,
  p_message_body TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_email TEXT;
  v_billing_email TEXT;
  v_recipient TEXT;
BEGIN
  -- 1. Find the target recipient
  SELECT 
    email, 
    (SELECT billing_email_address FROM public.school_settings WHERE school_id = p_school_id)
  INTO v_school_email, v_billing_email
  FROM public.schools_school
  WHERE id = p_school_id;

  v_recipient := COALESCE(v_billing_email, v_school_email);

  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'No contact email found for school %', p_school_id;
  END IF;

  -- 2. Log into communications (this marks it as 'pending' for an external worker to pick up and send)
  INSERT INTO public.saas_communications (
    school_id,
    recipient_email,
    subject,
    content,
    category,
    type,
    status
  ) VALUES (
    p_school_id,
    v_recipient,
    p_subject,
    p_message_body,
    'billing',
    'email',
    'pending'
  );

  -- 3. Mark invoice as 'sent' if it was draft
  UPDATE public.saas_invoices
  SET status = 'sent',
      updated_at = NOW()
  WHERE id = p_invoice_id AND status = 'draft';

END;
$$;

-- 2. Bulk notification for all renewal invoices that haven't been sent yet
CREATE OR REPLACE FUNCTION public.send_pending_renewal_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN 
    SELECT 
      i.id as invoice_id,
      i.invoice_number,
      i.amount,
      s.name as school_name,
      s.id as school_id
    FROM public.saas_invoices i
    JOIN public.schools_school s ON i.school_id = s.id
    WHERE i.status = 'draft' 
      AND i.invoice_number LIKE 'REN-%'
      AND i.created_at > (NOW() - INTERVAL '2 days')
  LOOP
    PERFORM public.send_billing_notification(
      v_row.school_id,
      v_row.invoice_id,
      'Annual Renewal Invoice for ' || v_row.school_name,
      'Dear Admin, your annual subscription for ' || v_row.school_name || 
      ' is due for renewal. A new invoice (' || v_row.invoice_number || 
      ') for KES ' || v_row.amount || ' has been generated.'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 3. Overdue Reminder logic
CREATE OR REPLACE FUNCTION public.send_overdue_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN 
    SELECT 
      i.id as invoice_id,
      i.invoice_number,
      i.amount,
      s.name as school_name,
      s.id as school_id
    FROM public.saas_invoices i
    JOIN public.schools_school s ON i.school_id = s.id
    WHERE i.status = 'overdue'
      -- Ensure we haven't sent an overdue reminder in the last 3 days
      AND NOT EXISTS (
        SELECT 1 FROM public.saas_communications c 
        WHERE c.school_id = s.id 
          AND c.subject LIKE '%OVERDUE%'
          AND c.created_at > (NOW() - INTERVAL '3 days')
      )
  LOOP
    PERFORM public.send_billing_notification(
      v_row.school_id,
      v_row.invoice_id,
      'URGENT: OVERDUE Invoice - ' || v_row.school_name,
      'Dear Admin, your subscription invoice ' || v_row.invoice_number || 
      ' is currently OVERDUE. Please settle the balance of KES ' || v_row.amount || 
      ' to avoid service interruption.'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
