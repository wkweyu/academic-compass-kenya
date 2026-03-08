
-- Enable RLS on transport_transportroute
ALTER TABLE transport_transportroute ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view routes for their school
CREATE POLICY "Users can view transport routes for their school"
ON transport_transportroute FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id());

-- Allow authenticated users to insert routes for their school
CREATE POLICY "Users can insert transport routes for their school"
ON transport_transportroute FOR INSERT TO authenticated
WITH CHECK (school_id = public.get_user_school_id());

-- Allow authenticated users to update routes for their school
CREATE POLICY "Users can update transport routes for their school"
ON transport_transportroute FOR UPDATE TO authenticated
USING (school_id = public.get_user_school_id())
WITH CHECK (school_id = public.get_user_school_id());

-- Allow authenticated users to delete routes for their school
CREATE POLICY "Users can delete transport routes for their school"
ON transport_transportroute FOR DELETE TO authenticated
USING (school_id = public.get_user_school_id());
