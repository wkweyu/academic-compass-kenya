CREATE OR REPLACE FUNCTION public.assign_school_portfolio(
  p_school_id BIGINT,
  p_owner_user_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'platform_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_owner_user_id IS NULL THEN
    DELETE FROM public.school_portfolio_assignments
    WHERE school_id = p_school_id;

    INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
    VALUES (p_school_id, auth.uid(), 'portfolio_unassigned', 'saas', 'school', p_school_id::TEXT, '{}'::jsonb);
    RETURN;
  END IF;

  IF NOT public.user_has_any_role(p_owner_user_id, ARRAY['platform_admin', 'support', 'account_manager', 'marketer']::public.app_role[]) THEN
    RAISE EXCEPTION 'Selected user must have a platform management role';
  END IF;

  INSERT INTO public.school_portfolio_assignments (school_id, owner_user_id, assigned_by, notes, updated_at)
  VALUES (p_school_id, p_owner_user_id, auth.uid(), COALESCE(p_notes, ''), NOW())
  ON CONFLICT (school_id)
  DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id,
    assigned_by = EXCLUDED.assigned_by,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  INSERT INTO public.audit_logs (school_id, user_id, action, module, entity_type, entity_id, new_values)
  VALUES (
    p_school_id,
    auth.uid(),
    'portfolio_assigned',
    'saas',
    'school',
    p_school_id::TEXT,
    jsonb_build_object('owner_user_id', p_owner_user_id, 'notes', COALESCE(p_notes, ''))
  );
END;
$$;

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

  INSERT INTO public.user_roles (user_id, role)
  SELECT DISTINCT
    pu.auth_user_id,
    pu.role::public.app_role
  FROM public.users pu
  WHERE pu.auth_user_id IS NOT NULL
    AND pu.school_id IS NULL
    AND pu.role IN ('platform_admin', 'support', 'account_manager', 'marketer')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = pu.auth_user_id
        AND ur.role = pu.role::public.app_role
    );

  RETURN QUERY
  SELECT
    au.id,
    COALESCE(au.email, '')::TEXT,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unnamed user')::TEXT,
    CASE
      WHEN public.has_role(au.id, 'platform_admin') THEN 'platform_admin'
      WHEN public.has_role(au.id, 'support') THEN 'support'
      WHEN public.has_role(au.id, 'account_manager') THEN 'account_manager'
      WHEN public.has_role(au.id, 'marketer') THEN 'marketer'
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

CREATE OR REPLACE FUNCTION public.get_all_schools_with_portfolios()
RETURNS TABLE(
  id BIGINT, name TEXT, code TEXT, email TEXT, phone TEXT,
  city TEXT, country TEXT, subscription_plan TEXT, subscription_status TEXT,
  subscription_end TIMESTAMPTZ, active BOOLEAN, created_at TIMESTAMPTZ,
  student_count BIGINT, teacher_count BIGINT,
  portfolio_owner_user_id UUID, portfolio_owner_name TEXT,
  portfolio_owner_email TEXT, portfolio_owner_role TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_view_platform_console(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name::TEXT,
    s.code::TEXT,
    s.email::TEXT,
    s.phone::TEXT,
    COALESCE(s.city, '')::TEXT,
    COALESCE(s.country, 'Kenya')::TEXT,
    COALESCE(s.subscription_plan, 'starter')::TEXT,
    COALESCE(s.subscription_status, 'active')::TEXT,
    s.subscription_end,
    s.active,
    s.created_at,
    (SELECT COUNT(*) FROM public.students st WHERE st.school_id = s.id AND st.is_active = TRUE)::BIGINT,
    (SELECT COUNT(*) FROM public.teachers t WHERE t.school_id = s.id AND t.is_active = TRUE)::BIGINT,
    spa.owner_user_id,
    COALESCE(NULLIF(TRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''), au.email, 'Unassigned')::TEXT,
    COALESCE(au.email, '')::TEXT,
    CASE
      WHEN public.has_role(spa.owner_user_id, 'platform_admin') THEN 'platform_admin'
      WHEN public.has_role(spa.owner_user_id, 'support') THEN 'support'
      WHEN public.has_role(spa.owner_user_id, 'account_manager') THEN 'account_manager'
      WHEN public.has_role(spa.owner_user_id, 'marketer') THEN 'marketer'
      ELSE ''
    END::TEXT
  FROM public.schools_school s
  LEFT JOIN public.school_portfolio_assignments spa ON spa.school_id = s.id
  LEFT JOIN auth.users au ON au.id = spa.owner_user_id
  LEFT JOIN public.users pu ON pu.auth_user_id = spa.owner_user_id
  WHERE EXISTS (
    SELECT 1
    FROM public.get_accessible_platform_school_ids(auth.uid()) accessible
    WHERE accessible.school_id = s.id
  )
  ORDER BY s.created_at DESC;
END;
$$;