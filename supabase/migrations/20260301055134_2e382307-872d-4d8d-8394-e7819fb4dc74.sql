
-- =====================================================
-- FEES ACCOUNTING SUBSYSTEM — New Tables
-- =====================================================

-- 1. Student Ledger: running balance per student
CREATE TABLE public.fees_student_ledger (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  debit_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  credit_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, student_id)
);
CREATE INDEX idx_fees_student_ledger_school ON public.fees_student_ledger(school_id);
CREATE INDEX idx_fees_student_ledger_student ON public.fees_student_ledger(student_id);

ALTER TABLE public.fees_student_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own school ledgers" ON public.fees_student_ledger
  FOR SELECT USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can insert own school ledgers" ON public.fees_student_ledger
  FOR INSERT WITH CHECK (school_id = public.get_user_school_id());
CREATE POLICY "Users can update own school ledgers" ON public.fees_student_ledger
  FOR UPDATE USING (school_id = public.get_user_school_id());

-- 2. Receipt: payment records with unique receipt numbers
CREATE TABLE public.fees_receipt (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  receipt_no TEXT NOT NULL,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  reference TEXT NOT NULL DEFAULT '',
  posted_by BIGINT REFERENCES public.users(id),
  term INTEGER NOT NULL DEFAULT 1,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  remarks TEXT NOT NULL DEFAULT '',
  is_reversed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, receipt_no)
);
CREATE INDEX idx_fees_receipt_school ON public.fees_receipt(school_id);
CREATE INDEX idx_fees_receipt_student ON public.fees_receipt(student_id);
CREATE INDEX idx_fees_receipt_date ON public.fees_receipt(created_at);

ALTER TABLE public.fees_receipt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own school receipts" ON public.fees_receipt
  FOR SELECT USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can insert own school receipts" ON public.fees_receipt
  FOR INSERT WITH CHECK (school_id = public.get_user_school_id());
CREATE POLICY "Users can update own school receipts" ON public.fees_receipt
  FOR UPDATE USING (school_id = public.get_user_school_id());

-- 3. Allocation: receipt → votehead breakdown
CREATE TABLE public.fees_allocation (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  receipt_id BIGINT NOT NULL REFERENCES public.fees_receipt(id) ON DELETE CASCADE,
  vote_head_id BIGINT NOT NULL REFERENCES public.fees_votehead(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fees_allocation_receipt ON public.fees_allocation(receipt_id);
CREATE INDEX idx_fees_allocation_votehead ON public.fees_allocation(vote_head_id);

ALTER TABLE public.fees_allocation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own school allocations" ON public.fees_allocation
  FOR SELECT USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can insert own school allocations" ON public.fees_allocation
  FOR INSERT WITH CHECK (school_id = public.get_user_school_id());

-- 4. Ledger Entry: double-entry accounting lines
CREATE TABLE public.fees_ledger_entry (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_debit TEXT NOT NULL,
  account_credit TEXT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  student_id BIGINT REFERENCES public.students(id),
  receipt_id BIGINT REFERENCES public.fees_receipt(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fees_ledger_entry_school ON public.fees_ledger_entry(school_id);
CREATE INDEX idx_fees_ledger_entry_date ON public.fees_ledger_entry(entry_date);
CREATE INDEX idx_fees_ledger_entry_student ON public.fees_ledger_entry(student_id);

ALTER TABLE public.fees_ledger_entry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own school ledger entries" ON public.fees_ledger_entry
  FOR SELECT USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can insert own school ledger entries" ON public.fees_ledger_entry
  FOR INSERT WITH CHECK (school_id = public.get_user_school_id());

-- 5. Fee Structure Items: separate items for a structure grouping
CREATE TABLE public.fees_structure_group (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  term INTEGER NOT NULL DEFAULT 1,
  student_group TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, name, academic_year, term)
);
CREATE INDEX idx_fees_structure_group_school ON public.fees_structure_group(school_id);

ALTER TABLE public.fees_structure_group ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own school structure groups" ON public.fees_structure_group
  FOR SELECT USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can insert own school structure groups" ON public.fees_structure_group
  FOR INSERT WITH CHECK (school_id = public.get_user_school_id());
CREATE POLICY "Users can update own school structure groups" ON public.fees_structure_group
  FOR UPDATE USING (school_id = public.get_user_school_id());
CREATE POLICY "Users can delete own school structure groups" ON public.fees_structure_group
  FOR DELETE USING (school_id = public.get_user_school_id());

CREATE TABLE public.fees_structure_item (
  id BIGSERIAL PRIMARY KEY,
  structure_group_id BIGINT NOT NULL REFERENCES public.fees_structure_group(id) ON DELETE CASCADE,
  vote_head_id BIGINT NOT NULL REFERENCES public.fees_votehead(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  UNIQUE(structure_group_id, vote_head_id)
);
CREATE INDEX idx_fees_structure_item_group ON public.fees_structure_item(structure_group_id);

ALTER TABLE public.fees_structure_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view structure items via group" ON public.fees_structure_item
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.fees_structure_group g WHERE g.id = structure_group_id AND g.school_id = public.get_user_school_id())
  );
CREATE POLICY "Users can insert structure items via group" ON public.fees_structure_item
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.fees_structure_group g WHERE g.id = structure_group_id AND g.school_id = public.get_user_school_id())
  );
CREATE POLICY "Users can update structure items via group" ON public.fees_structure_item
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.fees_structure_group g WHERE g.id = structure_group_id AND g.school_id = public.get_user_school_id())
  );
CREATE POLICY "Users can delete structure items via group" ON public.fees_structure_item
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.fees_structure_group g WHERE g.id = structure_group_id AND g.school_id = public.get_user_school_id())
  );

-- 6. Generate unique receipt number function
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_school_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT;
  counter INTEGER;
  receipt_num TEXT;
BEGIN
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  SELECT COALESCE(MAX(
    CASE WHEN receipt_no ~ ('^RCT' || year_str || '[0-9]+$')
    THEN CAST(SUBSTRING(receipt_no FROM LENGTH('RCT' || year_str) + 1) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO counter
  FROM public.fees_receipt
  WHERE school_id = p_school_id AND receipt_no LIKE 'RCT' || year_str || '%';
  
  receipt_num := 'RCT' || year_str || LPAD(counter::TEXT, 5, '0');
  RETURN receipt_num;
END;
$$;
