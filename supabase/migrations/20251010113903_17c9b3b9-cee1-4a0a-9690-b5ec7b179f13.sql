-- Allow authenticated users to create their own school (one per user)
-- Drop the restrictive policy that prevents school creation
DROP POLICY IF EXISTS "Prevent users from creating schools" ON public.schools_school;

-- Create a policy that allows users to create ONE school if they don't have one yet
CREATE POLICY "Users can create their own school"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only create a school if they don't already have one
  NOT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE users.id::text = auth.uid()::text 
      AND users.school_id IS NOT NULL
  )
);

-- Update the users table to link to the newly created school
-- This function will be called after school creation
CREATE OR REPLACE FUNCTION public.link_school_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Create trigger to automatically link school to user after creation
DROP TRIGGER IF EXISTS after_school_insert_link_user ON public.schools_school;
CREATE TRIGGER after_school_insert_link_user
AFTER INSERT ON public.schools_school
FOR EACH ROW
EXECUTE FUNCTION public.link_school_to_user();