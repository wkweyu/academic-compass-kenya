
-- Payroll tables
CREATE TABLE IF NOT EXISTS public.payroll_salary_structures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id),
  staff_id bigint NOT NULL REFERENCES public.teachers(id),
  basic_salary numeric NOT NULL DEFAULT 0,
  house_allowance numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  medical_allowance numeric NOT NULL DEFAULT 0,
  other_allowances numeric NOT NULL DEFAULT 0,
  nhif_deduction numeric NOT NULL DEFAULT 0,
  nssf_deduction numeric NOT NULL DEFAULT 0,
  paye_deduction numeric NOT NULL DEFAULT 0,
  loan_deduction numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric GENERATED ALWAYS AS (
    basic_salary + house_allowance + transport_allowance + medical_allowance + other_allowances
    - nhif_deduction - nssf_deduction - paye_deduction - loan_deduction - other_deductions
  ) STORED,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'approved', 'paid')),
  total_gross numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  total_net numeric NOT NULL DEFAULT 0,
  staff_count integer NOT NULL DEFAULT 0,
  approved_by bigint REFERENCES public.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, month, year)
);

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payroll_run_id bigint NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  staff_id bigint NOT NULL REFERENCES public.teachers(id),
  basic_salary numeric NOT NULL DEFAULT 0,
  total_allowances numeric NOT NULL DEFAULT 0,
  gross_salary numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net_salary numeric NOT NULL DEFAULT 0,
  payment_status varchar NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Accounting tables
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id),
  account_code varchar NOT NULL,
  account_name varchar NOT NULL,
  account_type varchar NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id bigint REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, account_code)
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number varchar NOT NULL,
  description text NOT NULL,
  total_debit numeric NOT NULL DEFAULT 0,
  total_credit numeric NOT NULL DEFAULT 0,
  status varchar NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided')),
  posted_by bigint REFERENCES public.users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  journal_entry_id bigint NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id bigint NOT NULL REFERENCES public.chart_of_accounts(id),
  debit_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.payroll_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payroll structures for their school"
  ON public.payroll_salary_structures FOR ALL
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can manage payroll runs for their school"
  ON public.payroll_runs FOR ALL
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can manage payroll entries for their school"
  ON public.payroll_entries FOR ALL
  USING (EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.id = payroll_entries.payroll_run_id
    AND pr.school_id = get_user_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM payroll_runs pr
    WHERE pr.id = payroll_entries.payroll_run_id
    AND pr.school_id = get_user_school_id()
  ));

CREATE POLICY "Users can manage chart of accounts for their school"
  ON public.chart_of_accounts FOR ALL
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can manage journal entries for their school"
  ON public.journal_entries FOR ALL
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can manage journal entry lines for their school"
  ON public.journal_entry_lines FOR ALL
  USING (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND je.school_id = get_user_school_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.id = journal_entry_lines.journal_entry_id
    AND je.school_id = get_user_school_id()
  ));
