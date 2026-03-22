
-- Class groups for uniform pricing tiers (e.g. "PG-PP2", "Grade 1-3", etc.)
CREATE TABLE public.uniform_class_groups (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  min_grade_level int NOT NULL,
  max_grade_level int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.uniform_class_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can manage uniform class groups"
  ON public.uniform_class_groups FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- Per-item pricing overrides by class group
CREATE TABLE public.uniform_item_prices (
  id bigserial PRIMARY KEY,
  school_id bigint NOT NULL REFERENCES public.schools_school(id) ON DELETE CASCADE,
  item_id bigint NOT NULL REFERENCES public.procurement_item(id) ON DELETE CASCADE,
  class_group_id bigint NOT NULL REFERENCES public.uniform_class_groups(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, item_id, class_group_id)
);

ALTER TABLE public.uniform_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users can manage uniform item prices"
  ON public.uniform_item_prices FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

-- Add class_group_id to uniform_issue_items so we know which price tier was used
ALTER TABLE public.uniform_issue_items ADD COLUMN class_group_name varchar(100) DEFAULT '';

-- Add store_issued flag to uniform_issues for tracking store issuance
ALTER TABLE public.uniform_issues ADD COLUMN store_issued boolean NOT NULL DEFAULT false;
ALTER TABLE public.uniform_issues ADD COLUMN store_issued_at timestamptz;
ALTER TABLE public.uniform_issues ADD COLUMN store_issued_by bigint;
