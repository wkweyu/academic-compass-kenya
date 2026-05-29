CREATE OR REPLACE FUNCTION public.generate_admission_number() RETURNS text LANGUAGE plpgsql AS $$ BEGIN RETURN to_char(CURRENT_DATE, 'YYYY') || LPAD(nextval('admission_number_seq')::text, 6, '0'); END; $$;
CREATE SEQUENCE IF NOT EXISTS admission_number_seq START 1;
