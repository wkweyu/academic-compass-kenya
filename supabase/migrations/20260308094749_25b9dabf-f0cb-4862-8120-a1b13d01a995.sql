-- Create a secure view for users table that excludes password column
CREATE OR REPLACE VIEW public.users_secure AS
SELECT 
  id, auth_user_id, username, email, first_name, last_name, phone,
  school_id, is_active, is_staff, is_superuser, date_joined, last_login,
  created_at, updated_at
FROM public.users;

-- Grant access to the view
GRANT SELECT ON public.users_secure TO authenticated;