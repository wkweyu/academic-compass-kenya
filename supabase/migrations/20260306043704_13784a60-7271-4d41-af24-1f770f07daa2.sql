
-- 1. Function to verify user belongs to a specific school
CREATE OR REPLACE FUNCTION public.verify_user_school(p_school_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
      AND school_id = p_school_id
  );
$$;

-- 2. Function to check subscription status for current user's school
CREATE OR REPLACE FUNCTION public.check_subscription_status()
RETURNS TABLE(
  is_valid boolean,
  plan text,
  status text,
  days_remaining integer,
  school_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_school_id bigint;
BEGIN
  SELECT u.school_id INTO v_school_id
  FROM public.users u WHERE u.auth_user_id = auth.uid();
  
  IF v_school_id IS NULL THEN
    RETURN QUERY SELECT false, ''::text, 'no_school'::text, 0, ''::text;
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    (s.active = true AND s.subscription_status IN ('active', 'trial'))::boolean AS is_valid,
    COALESCE(s.subscription_plan, 'starter')::text AS plan,
    COALESCE(s.subscription_status, 'inactive')::text AS status,
    CASE 
      WHEN s.subscription_end IS NOT NULL 
      THEN GREATEST(0, EXTRACT(DAY FROM s.subscription_end - NOW())::integer)
      ELSE 999
    END AS days_remaining,
    s.name::text AS school_name
  FROM public.schools_school s
  WHERE s.id = v_school_id;
END;
$$;

-- 3. Login attempts rate limiting table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id bigserial PRIMARY KEY,
  identifier text NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON public.login_attempts(identifier, attempted_at);

-- RLS: only the system can insert via security definer functions
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Function to check rate limit (max 5 failed attempts per 15 minutes)
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_identifier text)
RETURNS TABLE(allowed boolean, attempts_remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_max_attempts integer := 5;
  v_window_minutes integer := 15;
  v_oldest timestamptz;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.login_attempts
  WHERE identifier = p_identifier
    AND attempted_at > NOW() - (v_window_minutes || ' minutes')::interval
    AND success = false;
  
  IF v_count >= v_max_attempts THEN
    SELECT MIN(attempted_at) INTO v_oldest
    FROM public.login_attempts
    WHERE identifier = p_identifier
      AND attempted_at > NOW() - (v_window_minutes || ' minutes')::interval
      AND success = false;
    
    RETURN QUERY SELECT 
      false,
      0,
      EXTRACT(EPOCH FROM (v_oldest + (v_window_minutes || ' minutes')::interval - NOW()))::integer;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, (v_max_attempts - v_count)::integer, 0;
END;
$$;

-- Function to record a login attempt
CREATE OR REPLACE FUNCTION public.record_login_attempt(p_identifier text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.login_attempts (identifier, success)
  VALUES (p_identifier, p_success);
  
  -- Clean up old attempts (older than 1 hour)
  DELETE FROM public.login_attempts 
  WHERE attempted_at < NOW() - INTERVAL '1 hour';
END;
$$;
