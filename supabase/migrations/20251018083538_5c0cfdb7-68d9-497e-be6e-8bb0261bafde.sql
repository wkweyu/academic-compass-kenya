-- Add auth_user_id column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Make password and phone nullable since auth.users doesn't have these
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- Create or replace the trigger function to sync auth.users to public.users
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
    updated_at = NOW();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to sync new auth users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Insert existing auth users into public.users
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
)
SELECT 
  au.id,
  COALESCE(au.email, ''),
  COALESCE(au.email, ''),
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  true,
  false,
  false,
  au.created_at,
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.auth_user_id = au.id
);

-- Update get_current_user_profile function
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE(
  id bigint,
  username text,
  email text,
  first_name text,
  last_name text,
  phone text,
  role text,
  school_id bigint,
  is_active boolean,
  is_staff boolean,
  is_superuser boolean,
  date_joined timestamp with time zone,
  last_login timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.phone,
    ''::text as role,
    u.school_id,
    u.is_active,
    u.is_staff,
    u.is_superuser,
    u.date_joined,
    u.last_login,
    u.created_at,
    u.updated_at
  FROM public.users u
  WHERE u.auth_user_id = auth.uid();
$$;

-- Update get_user_school_id function
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT school_id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;