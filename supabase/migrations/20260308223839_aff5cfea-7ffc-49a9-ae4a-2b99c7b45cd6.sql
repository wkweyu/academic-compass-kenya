
-- Phase 1: Accounting Module Schema Enhancement

-- 1. Fiscal Years table
CREATE TABLE public.fiscal_years (
  id SERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);

ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view fiscal years" ON public.fiscal_years
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School members can insert fiscal years" ON public.fiscal_years
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School members can update fiscal years" ON public.fiscal_years
  FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- 2. Accounting Funds table (IPSAS)
CREATE TABLE public.accounting_funds (
  id SERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  fund_code TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  fund_type TEXT NOT NULL DEFAULT 'other' CHECK (fund_type IN ('tuition','government_grant','infrastructure','feeding','capitation','other')),
  description TEXT,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, fund_code)
);

ALTER TABLE public.accounting_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view funds" ON public.accounting_funds
  FOR SELECT TO authenticated USING (school_id = public.get_user_school_id());

CREATE POLICY "School members can insert funds" ON public.accounting_funds
  FOR INSERT TO authenticated WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School members can update funds" ON public.accounting_funds
  FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- 3. Bank Accounts table
CREATE TABLE public.bank_accounts (
  id SERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES public.chart_of_accounts(id),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  branch TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view bank accounts" ON public.bank_accounts
  FOR SELECT TO authenticated USING (school_id = public.get_user_school_id());

CREATE POLICY "School members can insert bank accounts" ON public.bank_accounts
  FOR INSERT TO authenticated WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School members can update bank accounts" ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- 4. Bank Reconciliation Entries
CREATE TABLE public.bank_reconciliation_entries (
  id SERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  bank_account_id INTEGER NOT NULL REFERENCES public.bank_accounts(id),
  reconciliation_date DATE NOT NULL,
  statement_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  ledger_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  adjusted_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  reconciled_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view reconciliations" ON public.bank_reconciliation_entries
  FOR SELECT TO authenticated USING (school_id = public.get_user_school_id());

CREATE POLICY "School members can insert reconciliations" ON public.bank_reconciliation_entries
  FOR INSERT TO authenticated WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School members can update reconciliations" ON public.bank_reconciliation_entries
  FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- 5. Bank Reconciliation Items
CREATE TABLE public.bank_reconciliation_items (
  id SERIAL PRIMARY KEY,
  reconciliation_id INTEGER NOT NULL REFERENCES public.bank_reconciliation_entries(id) ON DELETE CASCADE,
  journal_entry_id INTEGER REFERENCES public.journal_entries(id),
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL DEFAULT 'other' CHECK (item_type IN ('outstanding_check','deposit_in_transit','bank_charge','interest','other')),
  is_reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can manage reconciliation items" ON public.bank_reconciliation_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bank_reconciliation_entries bre
    WHERE bre.id = reconciliation_id AND bre.school_id = public.get_user_school_id()
  ));

-- 6. Alter chart_of_accounts: add fund_id, is_header
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES public.accounting_funds(id),
  ADD COLUMN IF NOT EXISTS is_header BOOLEAN NOT NULL DEFAULT false;

-- 7. Alter journal_entries: add fiscal_year_id, fund_id, reversal_of_id, is_reversal
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS fiscal_year_id INTEGER REFERENCES public.fiscal_years(id),
  ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES public.accounting_funds(id),
  ADD COLUMN IF NOT EXISTS reversal_of_id INTEGER REFERENCES public.journal_entries(id),
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false;

-- 8. Alter journal_entry_lines: add fund_id
ALTER TABLE public.journal_entry_lines
  ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES public.accounting_funds(id);

-- 9. Auto-generate journal entry reference numbers
CREATE OR REPLACE FUNCTION public.generate_journal_reference(p_school_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  counter INTEGER;
BEGIN
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CASE WHEN reference_number ~ ('^JE-' || year_str || '-[0-9]+$')
    THEN CAST(SUBSTRING(reference_number FROM LENGTH('JE-' || year_str || '-') + 1) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO counter
  FROM public.journal_entries
  WHERE school_id = p_school_id AND reference_number LIKE 'JE-' || year_str || '-%';
  
  RETURN 'JE-' || year_str || '-' || LPAD(counter::TEXT, 5, '0');
END;
$$;

-- 10. Reverse journal entry function (creates mirror entry)
CREATE OR REPLACE FUNCTION public.reverse_journal_entry(p_entry_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_original RECORD;
  v_new_id INTEGER;
  v_school_id BIGINT;
  v_ref TEXT;
BEGIN
  v_school_id := public.get_user_school_id();
  
  SELECT * INTO v_original FROM public.journal_entries
  WHERE id = p_entry_id AND school_id = v_school_id AND status = 'posted';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entry not found or not posted';
  END IF;
  
  -- Check not already reversed
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE reversal_of_id = p_entry_id) THEN
    RAISE EXCEPTION 'Entry already reversed';
  END IF;
  
  v_ref := public.generate_journal_reference(v_school_id);
  
  -- Create reversal entry
  INSERT INTO public.journal_entries (
    entry_date, reference_number, description, total_debit, total_credit,
    status, school_id, fiscal_year_id, fund_id, reversal_of_id, is_reversal,
    posted_at, created_at, updated_at
  ) VALUES (
    CURRENT_DATE, v_ref, 'REVERSAL: ' || v_original.description,
    v_original.total_credit, v_original.total_debit,
    'posted', v_school_id, v_original.fiscal_year_id, v_original.fund_id,
    p_entry_id, true, now(), now(), now()
  ) RETURNING id INTO v_new_id;
  
  -- Create reversed lines (swap debit/credit)
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description, fund_id)
  SELECT v_new_id, account_id, credit_amount, debit_amount, 'REVERSAL: ' || COALESCE(description, ''), fund_id
  FROM public.journal_entry_lines
  WHERE journal_entry_id = p_entry_id;
  
  -- Log audit
  PERFORM public.log_audit_event('reverse', 'accounting', 'journal_entry', p_entry_id::text,
    jsonb_build_object('original_ref', v_original.reference_number),
    jsonb_build_object('reversal_ref', v_ref, 'reversal_id', v_new_id));
  
  RETURN v_new_id;
END;
$$;
