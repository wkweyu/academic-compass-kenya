-- Fix RLS policy for users table UPDATE
-- The current policy incorrectly compares users.id (integer) with auth.uid() (uuid)
-- It should compare users.auth_user_id with auth.uid()

-- Drop the incorrect UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create the correct UPDATE policy
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());