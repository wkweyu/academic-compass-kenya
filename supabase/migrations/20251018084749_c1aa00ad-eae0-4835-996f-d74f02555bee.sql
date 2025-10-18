-- Fix RLS policies for schools_school to use auth_user_id instead of id

-- Drop existing policies
DROP POLICY IF EXISTS "Users without school can create one" ON public.schools_school;
DROP POLICY IF EXISTS "Users can view their school" ON public.schools_school;
DROP POLICY IF EXISTS "Users can update their school" ON public.schools_school;

-- Create corrected policies using auth_user_id
CREATE POLICY "Users without school can create one"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.auth_user_id = auth.uid()
    AND users.school_id IS NOT NULL
  )
);

CREATE POLICY "Users can view their school"
ON public.schools_school
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT school_id
    FROM public.users
    WHERE users.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their school"
ON public.schools_school
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT school_id
    FROM public.users
    WHERE users.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT school_id
    FROM public.users
    WHERE users.auth_user_id = auth.uid()
  )
);

-- Also update the link_school_to_user function to properly link the school
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the current user's school_id using auth_user_id
  UPDATE public.users
  SET school_id = NEW.id,
      updated_at = NOW()
  WHERE auth_user_id = auth.uid();
  
  RAISE NOTICE 'Linked school % to user %', NEW.id, auth.uid();
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;

CREATE TRIGGER after_school_insert_link_user
AFTER INSERT ON public.schools_school
FOR EACH ROW
EXECUTE FUNCTION public.link_school_to_user();