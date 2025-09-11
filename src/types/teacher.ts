// Teacher Management Types for Comprehensive School Administration

export interface Teacher {
  id: number;
  // Personal Information
  first_name: string;
  last_name: string;
  national_id?: string;
  passport_no?: string;
  date_of_birth: string;
  gender: 'Male' | 'Female';
  phone: string;
  email: string;
  address: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  
  // Employment Details
  employee_no: string;
  employment_type: 'Permanent' | 'Contract' | 'Intern' | 'Part-time';
  hire_date: string;
  job_title: string;
  designation: string;
  department: string;
  tsc_number?: string; // Teacher Service Commission Number (Kenya)
  
  // Banking & Tax Information
  bank_name?: string;
  bank_branch?: string;
  account_number?: string;
  kra_pin?: string; // Tax PIN
  nhif_number?: string; // Health Insurance
  nssf_number?: string; // Social Security
  
  // Salary Information
  salary_scale?: string;
  basic_salary: number;
  house_allowance?: number;
  transport_allowance?: number;
  responsibility_allowance?: number;
  other_allowances?: number;
  
  // Status & Metadata
  status: 'Active' | 'Suspended' | 'Terminated' | 'On Leave';
  school: number;
  created_at: string;
  updated_at: string;
  
  // Computed fields
  full_name?: string;
  years_of_service?: number;
  gross_salary?: number;
  assigned_subjects?: string[];
  assigned_classes?: string[];
}

export interface TeacherSubjectAssignment {
  id: number;
  teacher_id: number;
  subject_id: number;
  subject_name?: string;
  class_id?: number;
  class_name?: string;
  stream_id?: number;
  stream_name?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  is_class_teacher: boolean;
  created_at: string;
}

export interface TeacherClassAssignment {
  id: number;
  teacher_id: number;
  class_id: number;
  class_name?: string;
  stream_id?: number;
  stream_name?: string;
  academic_year: number;
  is_class_teacher: boolean;
  responsibility_type: 'Class Teacher' | 'Subject Teacher' | 'HOD' | 'Deputy Principal' | 'Principal';
  created_at: string;
}

export interface PayrollTransaction {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  employee_no?: string;
  month: number;
  year: number;
  
  // Earnings
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  responsibility_allowance: number;
  overtime_allowance: number;
  other_allowances: number;
  gross_pay: number;
  
  // Statutory Deductions
  paye_tax: number;
  nhif_deduction: number;
  nssf_deduction: number;
  
  // Other Deductions
  loan_deductions: number;
  sacco_deductions: number;
  other_deductions: number;
  total_deductions: number;
  
  // Final
  net_pay: number;
  
  // Metadata
  generated_on: string;
  generated_by?: number;
  status: 'Draft' | 'Approved' | 'Paid';
  payment_date?: string;
}

export interface AllowanceDeduction {
  id: number;
  name: string;
  type: 'Allowance' | 'Deduction';
  calculation_method: 'Fixed Amount' | 'Percentage of Basic' | 'Percentage of Gross';
  amount?: number;
  percentage?: number;
  is_statutory: boolean;
  is_taxable: boolean;
  description?: string;
  status: 'Active' | 'Inactive';
  school: number;
}

export interface TeacherAttendance {
  id: number;
  teacher_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave';
  leave_type?: 'Sick' | 'Annual' | 'Maternity' | 'Study' | 'Emergency';
  notes?: string;
  approved_by?: number;
  created_at: string;
}

export interface TeacherPerformance {
  id: number;
  teacher_id: number;
  evaluation_period: string;
  academic_year: number;
  term?: 1 | 2 | 3;
  
  // Performance Metrics
  teaching_effectiveness: number; // 1-5 scale
  classroom_management: number;
  student_engagement: number;
  curriculum_delivery: number;
  professional_development: number;
  collaboration: number;
  
  overall_rating: number;
  comments?: string;
  improvement_areas?: string;
  strengths?: string;
  
  evaluated_by: number;
  evaluation_date: string;
  status: 'Draft' | 'Completed' | 'Approved';
}

export interface TeacherFilters {
  search?: string;
  department?: string;
  employment_type?: string;
  status?: string;
  designation?: string;
  hire_date_from?: string;
  hire_date_to?: string;
}

export interface TeacherStats {
  total_teachers: number;
  active_teachers: number;
  teachers_by_department: { [key: string]: number };
  teachers_by_employment_type: { [key: string]: number };
  average_years_service: number;
  total_payroll_cost: number;
  teachers_on_leave: number;
  new_hires_this_month: number;
}

// Constants and Options
export const EMPLOYMENT_TYPES = [
  { value: 'Permanent', label: 'Permanent' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Intern', label: 'Intern' },
  { value: 'Part-time', label: 'Part-time' },
];

export const TEACHER_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'Suspended', label: 'Suspended', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Terminated', label: 'Terminated', color: 'bg-red-100 text-red-800' },
  { value: 'On Leave', label: 'On Leave', color: 'bg-blue-100 text-blue-800' },
];

export const DEPARTMENTS = [
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Sciences', label: 'Sciences' },
  { value: 'Languages', label: 'Languages' },
  { value: 'Social Studies', label: 'Social Studies' },
  { value: 'Arts', label: 'Creative Arts' },
  { value: 'Physical Education', label: 'Physical Education' },
  { value: 'ICT', label: 'ICT' },
  { value: 'Administration', label: 'Administration' },
];

export const JOB_TITLES = [
  { value: 'Teacher', label: 'Teacher' },
  { value: 'Senior Teacher', label: 'Senior Teacher' },
  { value: 'Head of Department', label: 'Head of Department' },
  { value: 'Deputy Principal', label: 'Deputy Principal' },
  { value: 'Principal', label: 'Principal' },
  { value: 'Academic Director', label: 'Academic Director' },
];

export const SALARY_SCALES = [
  { value: 'C1', label: 'C1 - Graduate Teacher' },
  { value: 'C2', label: 'C2 - Senior Teacher' },
  { value: 'C3', label: 'C3 - Principal Teacher' },
  { value: 'C4', label: 'C4 - Senior Principal Teacher' },
  { value: 'C5', label: 'C5 - Chief Principal Teacher' },
  { value: 'D1', label: 'D1 - Deputy Principal' },
  { value: 'D2', label: 'D2 - Principal' },
];
