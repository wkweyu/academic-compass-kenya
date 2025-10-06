-- =====================================================
-- DROP USER_PROFILES VIEW TO FIX SECURITY WARNING
-- =====================================================

-- Drop the view that was created in the first migration
DROP VIEW IF EXISTS public.user_profiles CASCADE;