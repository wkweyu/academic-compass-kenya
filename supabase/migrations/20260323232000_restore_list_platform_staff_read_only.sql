CREATE OR REPLACE FUNCTION public.list_platform_staff()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  primary_role TEXT,
  roles TEXT[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    COALESCE(au.email, '')::TEXT,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unnamed user')::TEXT,
    CASE
      WHEN public.has_role(au.id, 'account_manager') THEN 'account_manager'
      WHEN public.has_role(au.id, 'marketer') THEN 'marketer'
      WHEN public.has_role(au.id, 'support') THEN 'support'
      WHEN public.has_role(au.id, 'platform_admin') THEN 'platform_admin'
      ELSE ''
    END::TEXT,
    COALESCE(
      (
        SELECT array_agg(ur.role::TEXT ORDER BY ur.role::TEXT)
        FROM public.user_roles ur
        WHERE ur.user_id = au.id
          AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer')
      ),
      ARRAY[]::TEXT[]
    )
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.auth_user_id = au.id
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = au.id
      AND ur.role IN ('platform_admin', 'support', 'account_manager', 'marketer')
  )
  ORDER BY 3, 2;
END;
$$;