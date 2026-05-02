-- Hotfix: qualify billing_account_snapshot_v1 columns inside the RPC to avoid
-- ambiguity between PL/pgSQL variables and returned column names.

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