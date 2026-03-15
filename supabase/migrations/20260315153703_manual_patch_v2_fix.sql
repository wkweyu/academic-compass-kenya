
CREATE OR REPLACE FUNCTION public.get_all_schools_v2()
RETURNS SETOF public.schools_school
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT * FROM public.schools_school
  WHERE public.is_platform_admin(auth.uid()) 
     OR public.user_has_any_role(auth.uid(), ARRAY['support']::public.app_role[])
     OR id IN (SELECT school_id FROM public.get_accessible_platform_school_ids(auth.uid()))
  ORDER BY name ASC;
END;
$$;

