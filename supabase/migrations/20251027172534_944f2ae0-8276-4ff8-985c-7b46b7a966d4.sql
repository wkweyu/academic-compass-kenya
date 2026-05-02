-- Update foreign key constraints to allow deletion by setting references to NULL

-- Drop existing foreign key constraints
ALTER TABLE public.students 
  DROP CONSTRAINT IF EXISTS students_current_class_id_05b7cb5e_fk_classes_id;

ALTER TABLE public.students 
  DROP CONSTRAINT IF EXISTS students_current_stream_id_585d2899_fk_streams_id;

ALTER TABLE public.streams 
  DROP CONSTRAINT IF EXISTS streams_class_assigned_id_5f727004_fk_classes_id;

-- Recreate with ON DELETE SET NULL
ALTER TABLE public.students
  ADD CONSTRAINT students_current_class_id_fk_classes
  FOREIGN KEY (current_class_id) 
  REFERENCES public.classes(id) 
  ON DELETE SET NULL;

ALTER TABLE public.students
  ADD CONSTRAINT students_current_stream_id_fk_streams
  FOREIGN KEY (current_stream_id) 
  REFERENCES public.streams(id) 
  ON DELETE SET NULL;

ALTER TABLE public.streams
  ADD CONSTRAINT streams_class_assigned_id_fk_classes
  FOREIGN KEY (class_assigned_id) 
  REFERENCES public.classes(id) 
  ON DELETE CASCADE;  -- When a class is deleted, delete its streams too