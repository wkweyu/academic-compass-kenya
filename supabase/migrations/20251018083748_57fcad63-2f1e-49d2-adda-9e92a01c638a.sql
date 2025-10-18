-- Add unique constraint on auth_user_id to prevent duplicates
ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id);

-- Fix the handle_new_auth_user function to handle the unique constraint properly
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert or update user in public.users when a user signs up
  INSERT INTO public.users (
    auth_user_id,
    username,
    email,
    first_name,
    last_name,
    is_active,
    is_staff,
    is_superuser,
    date_joined,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
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
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;