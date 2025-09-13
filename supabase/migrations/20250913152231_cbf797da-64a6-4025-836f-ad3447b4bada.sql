-- Create classes table
CREATE TABLE public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  grade_level INTEGER NOT NULL,
  stream TEXT,
  academic_year TEXT NOT NULL,
  capacity INTEGER DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subjects table
CREATE TABLE public.subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guardians table
CREATE TABLE public.guardians (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  relationship TEXT NOT NULL,
  address TEXT,
  occupation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admission_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
  class_id UUID REFERENCES public.classes(id),
  guardian_id UUID REFERENCES public.guardians(id),
  photo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Transferred', 'Graduated')),
  medical_conditions TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  previous_school TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fees structure table
CREATE TABLE public.fee_structures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('Termly', 'Monthly', 'Annually', 'One-time')),
  class_id UUID REFERENCES public.classes(id),
  academic_year TEXT NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student fees table
CREATE TABLE public.student_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id),
  fee_structure_id UUID NOT NULL REFERENCES public.fee_structures(id),
  amount_due DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Paid', 'Overdue')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class subject allocations table
CREATE TABLE public.class_subject_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  teacher_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

-- Enable Row Level Security
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subject_allocations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for classes
CREATE POLICY "Users can view their own classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Users can create their own classes" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own classes" ON public.classes FOR UPDATE USING (true);
CREATE POLICY "Users can delete their own classes" ON public.classes FOR DELETE USING (true);

-- Create RLS policies for subjects
CREATE POLICY "Users can view subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Users can create subjects" ON public.subjects FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update subjects" ON public.subjects FOR UPDATE USING (true);
CREATE POLICY "Users can delete subjects" ON public.subjects FOR DELETE USING (true);

-- Create RLS policies for guardians
CREATE POLICY "Users can view guardians" ON public.guardians FOR SELECT USING (true);
CREATE POLICY "Users can create guardians" ON public.guardians FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update guardians" ON public.guardians FOR UPDATE USING (true);
CREATE POLICY "Users can delete guardians" ON public.guardians FOR DELETE USING (true);

-- Create RLS policies for students
CREATE POLICY "Users can view their own students" ON public.students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own students" ON public.students FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own students" ON public.students FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own students" ON public.students FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for fee structures
CREATE POLICY "Users can view their own fee structures" ON public.fee_structures FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fee structures" ON public.fee_structures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fee structures" ON public.fee_structures FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fee structures" ON public.fee_structures FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for student fees
CREATE POLICY "Users can view their own student fees" ON public.student_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own student fees" ON public.student_fees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own student fees" ON public.student_fees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own student fees" ON public.student_fees FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for class subject allocations
CREATE POLICY "Users can view their own allocations" ON public.class_subject_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own allocations" ON public.class_subject_allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own allocations" ON public.class_subject_allocations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own allocations" ON public.class_subject_allocations FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON public.guardians FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fee_structures_updated_at BEFORE UPDATE ON public.fee_structures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_student_fees_updated_at BEFORE UPDATE ON public.student_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to generate admission numbers
CREATE OR REPLACE FUNCTION public.generate_admission_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  counter INTEGER;
  admission_num TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Get the next counter for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(admission_number FROM LENGTH(year) + 2) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.students
  WHERE admission_number LIKE year || '%';
  
  -- Format as YYYY001, YYYY002, etc.
  admission_num := year || LPAD(counter::TEXT, 3, '0');
  
  RETURN admission_num;
END;
$$ LANGUAGE plpgsql;

-- Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true);

-- Create storage policies for student photos
CREATE POLICY "Student photos are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'student-photos');
CREATE POLICY "Users can upload student photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their student photos" ON storage.objects FOR UPDATE USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their student photos" ON storage.objects FOR DELETE USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);