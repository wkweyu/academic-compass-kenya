-- Fix RLS policy for school creation
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create their own school" ON public.schools_school;

-- Create a simpler policy that allows authenticated users to insert schools
-- The trigger will handle linking it to their user account
CREATE POLICY "Authenticated users can create school"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Ensure the trigger and function exist for auto-linking
-- Recreate the function to be extra safe
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update the current user's school_id to point to the newly created school
  UPDATE public.users
  SET school_id = NEW.id
  WHERE id::text = auth.uid()::text
    AND school_id IS NULL;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;
CREATE TRIGGER after_school_insert_link_user
  AFTER INSERT ON public.schools_school
  FOR EACH ROW
  EXECUTE FUNCTION public.link_school_to_user();