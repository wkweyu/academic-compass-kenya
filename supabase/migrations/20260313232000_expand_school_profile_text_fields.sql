ALTER TABLE public.schools_school
  ALTER COLUMN logo TYPE text USING logo::text,
  ALTER COLUMN motto TYPE text USING motto::text,
  ALTER COLUMN website TYPE text USING website::text;