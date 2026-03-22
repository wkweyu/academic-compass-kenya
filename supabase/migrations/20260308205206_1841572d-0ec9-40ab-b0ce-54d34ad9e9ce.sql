-- Add detailed breakdown columns to payroll_entries for payslip generation
ALTER TABLE public.payroll_entries
  ADD COLUMN IF NOT EXISTS house_allowance numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS medical_allowance numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS other_allowances numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS nhif_deduction numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS nssf_deduction numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS paye_deduction numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS loan_deduction numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS other_deductions numeric DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS bank_name varchar(100) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS bank_branch varchar(100) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS account_number varchar(50) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS employee_no varchar(50) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS staff_name varchar(200) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS department varchar(100) DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS school_id bigint REFERENCES schools_school(id);

-- Add responsibility_allowance to salary structures  
ALTER TABLE public.payroll_salary_structures
  ADD COLUMN IF NOT EXISTS responsibility_allowance numeric DEFAULT 0 NOT NULL;

-- Add description to payroll_runs
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS description text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;