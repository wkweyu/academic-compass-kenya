-- Simplify the RLS policy - just allow authenticated users to create schools
-- The trigger will handle linking, we just need to allow the insert
DROP POLICY IF EXISTS "Users can create school if they don't have one" ON public.schools_school;

CREATE POLICY "Authenticated users can create schools"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add a check in the trigger to prevent multiple schools per user
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_school_id bigint;
BEGIN
  -- Check if user already has a school
  SELECT school_id INTO user_school_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  -- If user already has a school, raise an exception
  IF user_school_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a school assigned';
  END IF;
  
  -- Update the current user's school_id using auth_user_id
  UPDATE public.users
  SET school_id = NEW.id,
      updated_at = NOW()
  WHERE auth_user_id = auth.uid();
  
  RAISE NOTICE 'Linked school % to user %', NEW.id, auth.uid();
  
  RETURN NEW;
END;
$$;