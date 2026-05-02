ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_name_key;

DROP INDEX IF EXISTS public.classes_name_key;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_school_name_unique;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_school_name_unique UNIQUE (school_id, name);