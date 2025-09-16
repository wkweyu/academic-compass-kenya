-- Insert sample classes for testing
INSERT INTO public.classes (name, grade_level, stream, academic_year, capacity) VALUES
('Grade 1', 1, 'East', '2024', 40),
('Grade 1', 1, 'West', '2024', 40),
('Grade 2', 2, 'East', '2024', 40),
('Grade 2', 2, 'West', '2024', 40),
('Grade 3', 3, 'East', '2024', 40),
('Grade 3', 3, 'West', '2024', 40),
('Grade 4', 4, 'East', '2024', 40),
('Grade 4', 4, 'West', '2024', 40);

-- Also add some subjects
INSERT INTO public.subjects (name, code, description) VALUES
('Mathematics', 'MATH', 'Core Mathematics subject'),
('English', 'ENG', 'English Language and Literature'),
('Science', 'SCI', 'General Science'),
('Social Studies', 'SS', 'Social Studies and Geography'),
('Art', 'ART', 'Creative Arts'),
('Physical Education', 'PE', 'Physical Education and Sports');