-- Add missing columns to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS employee_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS staff_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(100),
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS school_id BIGINT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS national_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS passport_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(50),
ADD COLUMN IF NOT EXISTS nhif_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS salary_scale VARCHAR(50),
ADD COLUMN IF NOT EXISTS basic_salary DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS house_allowance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_allowance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS responsibility_allowance DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_allowances DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';

-- Add foreign key constraint for school_id
ALTER TABLE teachers
ADD CONSTRAINT fk_teachers_school 
FOREIGN KEY (school_id) 
REFERENCES schools_school(id) 
ON DELETE CASCADE;

-- Create index on school_id for better query performance
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);

-- Update full_name to be nullable (will be auto-generated from first_name + last_name)
ALTER TABLE teachers ALTER COLUMN full_name DROP NOT NULL;

-- Enable RLS on teachers table
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for teachers
CREATE POLICY "Users can view teachers from their school"
ON teachers FOR SELECT
USING (school_id = (SELECT school_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create teachers for their school"
ON teachers FOR INSERT
WITH CHECK (school_id = (SELECT school_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update teachers from their school"
ON teachers FOR UPDATE
USING (school_id = (SELECT school_id FROM users WHERE auth_user_id = auth.uid()))
WITH CHECK (school_id = (SELECT school_id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete teachers from their school"
ON teachers FOR DELETE
USING (school_id = (SELECT school_id FROM users WHERE auth_user_id = auth.uid()));