CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resolved_email TEXT := LOWER(COALESCE(NEW.email, ''));
  resolved_first_name TEXT := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  resolved_last_name TEXT := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  linked_role TEXT;
BEGIN
  UPDATE public.users
  SET
    auth_user_id = NEW.id,
    username = COALESCE(NULLIF(username, ''), resolved_email),
    email = COALESCE(NULLIF(email, ''), resolved_email),
    first_name = COALESCE(NULLIF(first_name, ''), resolved_first_name),
    last_name = COALESCE(NULLIF(last_name, ''), resolved_last_name),
    updated_at = NOW()
  WHERE auth_user_id IS NULL
    AND school_id IS NULL
    AND LOWER(COALESCE(email, '')) = resolved_email;

  IF NOT FOUND THEN
    INSERT INTO public.users (
      auth_user_id,
      username,
      email,
      first_name,
      last_name,
      role,
      is_active,
      is_staff,
      is_superuser,
      date_joined,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      resolved_email,
      resolved_email,
      resolved_first_name,
      resolved_last_name,
      COALESCE(NULLIF(LOWER(COALESCE(NEW.raw_user_meta_data->>'role', '')), ''), 'staff'),
      true,
      false,
      false,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      first_name = COALESCE(NULLIF(public.users.first_name, ''), EXCLUDED.first_name),
      last_name = COALESCE(NULLIF(public.users.last_name, ''), EXCLUDED.last_name),
      updated_at = NOW();
  END IF;

  SELECT LOWER(COALESCE(role, ''))
  INTO linked_role
  FROM public.users
  WHERE auth_user_id = NEW.id
  LIMIT 1;

  IF linked_role IN ('platform_admin', 'support', 'account_manager', 'marketer', 'manager') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, linked_role::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;