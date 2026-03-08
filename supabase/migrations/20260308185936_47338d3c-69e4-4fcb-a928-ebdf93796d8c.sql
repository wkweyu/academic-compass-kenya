
-- Uniform Issues table
CREATE TABLE public.uniform_issues (
  id BIGSERIAL PRIMARY KEY,
  school_id BIGINT NOT NULL REFERENCES public.schools_school(id),
  student_id BIGINT NOT NULL REFERENCES public.students(id),
  issued_by BIGINT REFERENCES public.users(id),
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  term INTEGER NOT NULL,
  year INTEGER NOT NULL,
  remarks TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uniform Issue Items table
CREATE TABLE public.uniform_issue_items (
  id BIGSERIAL PRIMARY KEY,
  issue_id BIGINT NOT NULL REFERENCES public.uniform_issues(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES public.procurement_item(id),
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.uniform_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniform_issue_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for uniform_issues
CREATE POLICY "School users can view uniform issues" ON public.uniform_issues
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School users can insert uniform issues" ON public.uniform_issues
  FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id());

-- RLS policies for uniform_issue_items
CREATE POLICY "School users can view uniform issue items" ON public.uniform_issue_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.uniform_issues ui 
    WHERE ui.id = uniform_issue_items.issue_id 
    AND ui.school_id = public.get_user_school_id()
  ));

CREATE POLICY "School users can insert uniform issue items" ON public.uniform_issue_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.uniform_issues ui 
    WHERE ui.id = uniform_issue_items.issue_id 
    AND ui.school_id = public.get_user_school_id()
  ));

-- Indexes
CREATE INDEX idx_uniform_issues_school ON public.uniform_issues(school_id);
CREATE INDEX idx_uniform_issues_student ON public.uniform_issues(student_id);
CREATE INDEX idx_uniform_issue_items_issue ON public.uniform_issue_items(issue_id);
