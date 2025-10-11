-- Fix the school code length constraint and add school type field
ALTER TABLE public.schools_school 
  ALTER COLUMN code TYPE varchar(50);

-- Add school type field
ALTER TABLE public.schools_school 
  ADD COLUMN IF NOT EXISTS type varchar(50);

-- Add motto field
ALTER TABLE public.schools_school 
  ADD COLUMN IF NOT EXISTS motto text;

-- Add website field
ALTER TABLE public.schools_school 
  ADD COLUMN IF NOT EXISTS website varchar(255);