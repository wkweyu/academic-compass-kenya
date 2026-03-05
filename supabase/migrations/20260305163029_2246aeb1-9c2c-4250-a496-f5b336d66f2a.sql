-- Drop the overly permissive USING(true) policies on subjects and teachers tables
DROP POLICY IF EXISTS "Authenticated users can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated users can manage teachers" ON public.teachers;