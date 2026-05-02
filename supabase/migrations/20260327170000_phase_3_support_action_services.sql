-- Phase 3: Secure Support Action Services
-- This migration provides structured services for support staff to perform
-- common corrective actions (balance adjustments, payment reversals, etc.)
-- with built-in auditing, tenant-scoping, and role-based access control.

-- 1. Support Action: Adjust Student Fees Balance
-- Allows support to manually adjust a specific fee component (Vote Head) for a student.
CREATE OR REPLACE FUNCTION public.support_adjust_student_balance(
  p_school_id BIGINT,
  p_student_id UUID,
  p_vote_head_id BIGINT,
  p_adjustment_amount DECIMAL,
  p_reason TEXT,
  p_ticket_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_balance DECIMAL;
  v_new_balance DECIMAL;
  v_log_id BIGINT;
  v_student_name TEXT;
  v_vote_head_name TEXT;
BEGIN
  -- 1. Security & Permissions Check
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Support manager privileges required';
  END IF;

  -- 2. Tenant & Record Validation
  IF NOT EXISTS (SELECT 1 FROM public.schools_school WHERE id = p_school_id) THEN
    RAISE EXCEPTION 'Invalid school ID';
  END IF;

  SELECT (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) INTO v_student_name
  FROM public.users WHERE id = p_student_id AND school_id = p_school_id;
  
  IF v_student_name IS NULL THEN
    RAISE EXCEPTION 'Student not found in this school';
  END IF;

  SELECT name INTO v_vote_head_name 
  FROM public.fees_votehead WHERE id = p_vote_head_id AND school_id = p_school_id;

  IF v_vote_head_name IS NULL THEN
    RAISE EXCEPTION 'Vote head not found in this school';
  END IF;

  -- 3. Capture Old State
  SELECT closing_balance INTO v_old_balance
  FROM public.fees_feebalance
  WHERE student_id = p_student_id AND vote_head_id = p_vote_head_id
  FOR UPDATE;

  IF v_old_balance IS NULL THEN
    -- Initialize balance if missing
    v_old_balance := 0;
    INSERT INTO public.fees_feebalance (student_id, vote_head_id, school_id, opening_balance, amount_invoiced, amount_paid, closing_balance)
    VALUES (p_student_id, p_vote_head_id, p_school_id, 0, 0, 0, 0);
  END IF;

  -- 4. Apply Adjustment
  UPDATE public.fees_feebalance
  SET 
    closing_balance = closing_balance + p_adjustment_amount,
    updated_at = NOW()
  WHERE student_id = p_student_id AND vote_head_id = p_vote_head_id
  RETURNING closing_balance INTO v_new_balance;

  -- 5. Create Supporting Ledger Entry (Audit Trail in Business Logic)
  INSERT INTO public.fees_debittransaction (
    student_id, vote_head_id, school_id, amount, description, created_at
  ) VALUES (
    p_student_id, p_vote_head_id, p_school_id, p_adjustment_amount, 
    'Support Adjustment: ' || p_reason || ' (Ticket #' || COALESCE(p_ticket_id::TEXT, 'N/A') || ')',
    NOW()
  );

  -- 6. Log to Support Audit
  v_log_id := public.log_support_action(
    p_school_id,
    p_ticket_id,
    'ADJUST_STUDENT_BALANCE',
    'fees_feebalance',
    p_student_id::TEXT || ':' || p_vote_head_id::TEXT,
    jsonb_build_object('balance', v_old_balance),
    jsonb_build_object('balance', v_new_balance, 'adjustment', p_adjustment_amount, 'reason', p_reason),
    jsonb_build_object('student_name', v_student_name, 'vote_head', v_vote_head_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'log_id', v_log_id
  );
END;
$$;

-- 2. Support Action: Reverse Payment Receipt
-- Controlled reversal of a payment with automatic ledger echoing.
CREATE OR REPLACE FUNCTION public.support_reverse_payment(
  p_school_id BIGINT,
  p_receipt_id BIGINT,
  p_reason TEXT,
  p_ticket_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_receipt_data RECORD;
  v_log_id BIGINT;
BEGIN
  -- 1. Security Check
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Receipt Validation
  SELECT * INTO v_receipt_data
  FROM public.fees_receipt
  WHERE id = p_receipt_id AND school_id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt #% not found in school #%', p_receipt_id, p_school_id;
  END IF;

  IF v_receipt_data.is_reversed THEN
    RAISE EXCEPTION 'Receipt is already reversed';
  END IF;

  -- 3. Perform Reversal Logic
  -- Mark receipt as reversed
  UPDATE public.fees_receipt
  SET 
    is_reversed = true,
    reversal_reason = p_reason,
    reversed_at = NOW(),
    reversed_by = auth.uid()
  WHERE id = p_receipt_id;

  -- ECHO: Update Fee Balances (add back the allocated amounts)
  -- This assumes a simple structure; complex allocation logic might need more logic
  UPDATE public.fees_feebalance fb
  SET 
    amount_paid = fb.amount_paid - fa.amount,
    closing_balance = fb.closing_balance + fa.amount
  FROM public.fees_allocation fa
  WHERE fa.receipt_id = p_receipt_id
    AND fa.student_id = fb.student_id
    AND fa.vote_head_id = fb.vote_head_id;

  -- 4. Log to Support Audit
  v_log_id := public.log_support_action(
    p_school_id,
    p_ticket_id,
    'REVERSE_PAYMENT',
    'fees_receipt',
    p_receipt_id::TEXT,
    to_jsonb(v_receipt_data),
    jsonb_build_object('is_reversed', true, 'reversal_reason', p_reason),
    jsonb_build_object('amount', v_receipt_data.amount_paid, 'receipt_number', v_receipt_data.receipt_number)
  );

  RETURN jsonb_build_object(
    'success', true,
    'receipt_id', p_receipt_id,
    'log_id', v_log_id
  );
END;
$$;

-- 3. Support Action: Reset User Password (Support Token generation)
-- Generates a temporary secure recovery token for a user.
CREATE OR REPLACE FUNCTION public.support_reset_user_password(
  p_school_id BIGINT,
  p_user_id UUID,
  p_ticket_id BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_log_id BIGINT;
BEGIN
  -- 1. Security Check
  IF NOT public.can_manage_support_workspace(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. User Validation
  SELECT email INTO v_user_email
  FROM public.users
  WHERE id = p_user_id AND school_id = p_school_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found in this school';
  END IF;

  -- 3. Log Intent (We don't set the password directly here to avoid security risks, 
  -- but we log that support initiated a recovery process)
  v_log_id := public.log_support_action(
    p_school_id,
    p_ticket_id,
    'INITIATE_PASSWORD_RESET',
    'users',
    p_user_id::TEXT,
    NULL,
    jsonb_build_object('action', 'recovery_initiated'),
    jsonb_build_object('email', v_user_email)
  );

  -- Note: In a production Supabase environment, you'd typically call a management API
  -- or use the auth.users table if you have a service_role key. 
  -- Here we are establishing the AUDIT loop.

  RETURN jsonb_build_object(
    'success', true,
    'email', v_user_email,
    'log_id', v_log_id,
    'message', 'Audit record created. Please use the platform Auth management to send the reset link.'
  );
END;
$$;
