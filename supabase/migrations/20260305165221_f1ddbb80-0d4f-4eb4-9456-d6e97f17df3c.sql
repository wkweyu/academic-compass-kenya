
-- Add platform_admin role to enum (must be in its own transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';
