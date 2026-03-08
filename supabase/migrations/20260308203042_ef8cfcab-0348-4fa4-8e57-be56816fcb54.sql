
-- New table: LPO line items
CREATE TABLE public.procurement_lpo_items (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id),
  lpo_id BIGINT NOT NULL REFERENCES public.procurement_lpo(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES public.procurement_item(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- Add delivery tracking columns to LPO
ALTER TABLE public.procurement_lpo 
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_note VARCHAR(255),
  ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(255);

-- Auto-number function for LPOs
CREATE OR REPLACE FUNCTION public.generate_lpo_number(p_school_id BIGINT)
RETURNS TEXT
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
    CASE WHEN lpo_number ~ ('^LPO' || year_str || '[0-9]+$')
    THEN CAST(SUBSTRING(lpo_number FROM LENGTH('LPO' || year_str) + 1) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO counter
  FROM public.procurement_lpo
  WHERE school_id = p_school_id AND lpo_number LIKE 'LPO' || year_str || '%';
  
  RETURN 'LPO' || year_str || LPAD(counter::TEXT, 4, '0');
END;
$$;

-- Auto-number function for Payment Vouchers
CREATE OR REPLACE FUNCTION public.generate_pv_number(p_school_id BIGINT)
RETURNS TEXT
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
    CASE WHEN voucher_number ~ ('^PV' || year_str || '[0-9]+$')
    THEN CAST(SUBSTRING(voucher_number FROM LENGTH('PV' || year_str) + 1) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO counter
  FROM public.procurement_paymentvoucher
  WHERE school_id = p_school_id AND voucher_number LIKE 'PV' || year_str || '%';
  
  RETURN 'PV' || year_str || LPAD(counter::TEXT, 4, '0');
END;
$$;

-- RLS on new table
ALTER TABLE public.procurement_lpo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can view their lpo items"
  ON public.procurement_lpo_items FOR SELECT
  TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School users can insert their lpo items"
  ON public.procurement_lpo_items FOR INSERT
  TO authenticated
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School users can update their lpo items"
  ON public.procurement_lpo_items FOR UPDATE
  TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School users can delete their lpo items"
  ON public.procurement_lpo_items FOR DELETE
  TO authenticated
  USING (school_id = public.get_user_school_id());
