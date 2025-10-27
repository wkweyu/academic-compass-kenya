-- Create stream_name_settings table for uniform stream naming
CREATE TABLE IF NOT EXISTS public.stream_name_settings (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  school_id BIGINT REFERENCES public.schools_school(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add RLS policies for stream_name_settings
ALTER TABLE public.stream_name_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stream names from their school"
  ON public.stream_name_settings
  FOR SELECT
  USING (school_id = get_user_school_id());

CREATE POLICY "Users can create stream names for their school"
  ON public.stream_name_settings
  FOR INSERT
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can update stream names from their school"
  ON public.stream_name_settings
  FOR UPDATE
  USING (school_id = get_user_school_id())
  WITH CHECK (school_id = get_user_school_id());

CREATE POLICY "Users can delete stream names from their school"
  ON public.stream_name_settings
  FOR DELETE
  USING (school_id = get_user_school_id());

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stream_name_settings_school ON public.stream_name_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_stream_name_settings_active ON public.stream_name_settings(is_active);