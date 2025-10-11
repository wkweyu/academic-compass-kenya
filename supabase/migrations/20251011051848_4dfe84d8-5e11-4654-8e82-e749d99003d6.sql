-- Remove the role column from users table
-- This eliminates the dual role system security vulnerability
-- Roles are now exclusively managed via the user_roles table

-- First, ensure we're not breaking any foreign key constraints
-- Drop the role column from the users table
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- Add a comment to document this security fix
COMMENT ON TABLE public.users IS 'User authentication table. Roles are stored in user_roles table for security.';
