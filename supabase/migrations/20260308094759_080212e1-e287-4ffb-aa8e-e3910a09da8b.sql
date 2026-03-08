-- Fix security definer view - make it SECURITY INVOKER
ALTER VIEW public.users_secure SET (security_invoker = true);