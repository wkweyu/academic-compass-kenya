-- Create a security definer function to check if user can create a school
CREATE OR REPLACE FUNCTION public.user_can_create_school()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user doesn't exist in users table or exists with NULL school_id
  RETURN NOT EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND school_id IS NOT NULL
  );
END;
$$;

-- Update the INSERT policy on schools_school to use this function
DROP POLICY IF EXISTS "Users can create school if they don't have one" ON public.schools_school;

CREATE POLICY "Users can create school if they don't have one"
ON public.schools_school
FOR INSERT
TO authenticated
WITH CHECK (public.user_can_create_school());