
-- Add Housing Levy and NITA Levy columns to payroll tables
ALTER TABLE payroll_salary_structures 
  ADD COLUMN IF NOT EXISTS housing_levy numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nita_levy numeric DEFAULT 0;

ALTER TABLE payroll_entries
  ADD COLUMN IF NOT EXISTS housing_levy numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nita_levy numeric DEFAULT 0;

-- Add Housing Levy Payable and NITA Payable to chart of accounts (will be inserted per-school via seed)
-- We'll handle this in the application layer via accountingService.seedDefaultAccounts()

-- Create a payroll_statutory_rates table for maintainable rates (not hardcoded)
CREATE TABLE IF NOT EXISTS public.payroll_statutory_rates (
  id serial PRIMARY KEY,
  school_id integer REFERENCES schools_school(id) ON DELETE CASCADE NOT NULL,
  rate_name text NOT NULL,
  rate_type text NOT NULL CHECK (rate_type IN ('bracket', 'percentage', 'flat')),
  rate_value numeric DEFAULT 0,
  bracket_data jsonb DEFAULT '[]'::jsonb,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, rate_name, effective_from)
);

ALTER TABLE public.payroll_statutory_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their school statutory rates"
  ON public.payroll_statutory_rates
  FOR ALL
  TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- Update the generated column for net_salary to include housing_levy and nita_levy
-- First drop the generated column and recreate it
ALTER TABLE payroll_salary_structures 
  DROP COLUMN IF EXISTS net_salary;

ALTER TABLE payroll_salary_structures 
  ADD COLUMN net_salary numeric GENERATED ALWAYS AS (
    (basic_salary + house_allowance + transport_allowance + medical_allowance + COALESCE(responsibility_allowance, 0) + other_allowances)
    - (nhif_deduction + nssf_deduction + paye_deduction + loan_deduction + other_deductions + COALESCE(housing_levy, 0) + COALESCE(nita_levy, 0))
  ) STORED;
