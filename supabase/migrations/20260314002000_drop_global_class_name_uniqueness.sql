DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'classes'
      AND con.contype = 'u'
      AND array_length(con.conkey, 1) = 1
      AND (
        SELECT att.attname
        FROM pg_attribute att
        WHERE att.attrelid = rel.oid
          AND att.attnum = con.conkey[1]
      ) = 'name'
  LOOP
    EXECUTE format('ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END;
$$;

DO $$
DECLARE
  index_name text;
BEGIN
  FOR index_name IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'classes'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%(name)%'
      AND indexdef NOT ILIKE '%school_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', index_name);
  END LOOP;
END;
$$;

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_school_name_unique;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_school_name_unique UNIQUE (school_id, name);