-- 1. Add school_id to guardians table for proper scoping
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS school_id bigint REFERENCES public.schools_school(id);

-- 2. Drop all permissive policies on guardians
DROP POLICY IF EXISTS "Users can create guardians" ON public.guardians;
DROP POLICY IF EXISTS "Users can delete guardians" ON public.guardians;
DROP POLICY IF EXISTS "Users can update guardians" ON public.guardians;
DROP POLICY IF EXISTS "Users can view guardians" ON public.guardians;

-- 3. Create school-scoped policies on guardians
CREATE POLICY "School users can view guardians"
  ON public.guardians FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id());

CREATE POLICY "School users can create guardians"
  ON public.guardians FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School users can update guardians"
  ON public.guardians FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id())
  WITH CHECK (school_id = public.get_user_school_id());

CREATE POLICY "School users can delete guardians"
  ON public.guardians FOR DELETE TO authenticated
  USING (school_id = public.get_user_school_id());

-- 4. Fix schools_school INSERT policy - restrict to users who don't already have a school
DROP POLICY IF EXISTS "Authenticated users can create schools" ON public.schools_school;
CREATE POLICY "Authenticated users can create schools"
  ON public.schools_school FOR INSERT TO authenticated
  WITH CHECK (public.user_can_create_school());