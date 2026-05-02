// Staff Management Types for Comprehensive School Administration
// Covers both teaching and non-teaching staff for unified payroll management

export interface Staff {
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
  employment_type: 'Permanent' | 'Contract' | 'Intern' | 'Part-time' | 'Casual';
  hire_date: string;
  job_title: string;
  designation: string;
  department: string;
  staff_category: 'Teaching Staff' | 'Administrative Staff' | 'Support Staff' | 'Security Staff' | 'Maintenance Staff';
  tsc_number?: string; // Teacher Service Commission Number (Kenya) - only for teachers
  
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

// For backward compatibility
export interface Teacher extends Staff {
  staff_category: 'Teaching Staff';
}

export interface StaffSubjectAssignment {
  id: number;
  staff_id: number;
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

export interface StaffClassAssignment {
  id: number;
  staff_id: number;
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
  staff_id: number;
  staff_name?: string;
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

export interface StaffAttendance {
  id: number;
  staff_id: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave';
  leave_type?: 'Sick' | 'Annual' | 'Maternity' | 'Study' | 'Emergency';
  notes?: string;
  approved_by?: number;
  created_at: string;
}

export interface StaffPerformance {
  id: number;
  staff_id: number;
  evaluation_period: string;
  academic_year: number;
  term?: 1 | 2 | 3;
  
  // Performance Metrics
  job_effectiveness: number; // 1-5 scale
  teamwork: number;
  punctuality: number;
  professionalism: number;
  communication: number;
  initiative: number;
  
  overall_rating: number;
  comments?: string;
  improvement_areas?: string;
  strengths?: string;
  
  evaluated_by: number;
  evaluation_date: string;
  status: 'Draft' | 'Completed' | 'Approved';
}

export interface StaffFilters {
  search?: string;
  department?: string;
  employment_type?: string;
  status?: string;
  staff_category?: string;
  designation?: string;
  hire_date_from?: string;
  hire_date_to?: string;
}

export interface StaffStats {
  total_staff: number;
  active_staff: number;
  staff_by_department: { [key: string]: number };
  staff_by_category: { [key: string]: number };
  staff_by_employment_type: { [key: string]: number };
  average_years_service: number;
  total_payroll_cost: number;
  staff_on_leave: number;
  new_hires_this_month: number;
}

// Backward compatibility types
export interface TeacherSubjectAssignment extends StaffSubjectAssignment {}
export interface TeacherClassAssignment extends StaffClassAssignment {}
export interface TeacherAttendance extends StaffAttendance {}
export interface TeacherPerformance extends StaffPerformance {}
export interface TeacherFilters extends StaffFilters {}
export interface TeacherStats extends StaffStats {}

// Constants and Options
export const EMPLOYMENT_TYPES = [
  { value: 'Permanent', label: 'Permanent' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Intern', label: 'Intern' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Casual', label: 'Casual' },
];

export const STAFF_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'Suspended', label: 'Suspended', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'Terminated', label: 'Terminated', color: 'bg-red-100 text-red-800' },
  { value: 'On Leave', label: 'On Leave', color: 'bg-blue-100 text-blue-800' },
];

export const STAFF_CATEGORIES = [
  { value: 'Teaching Staff', label: 'Teaching Staff' },
  { value: 'Administrative Staff', label: 'Administrative Staff' },
  { value: 'Support Staff', label: 'Support Staff' },
  { value: 'Security Staff', label: 'Security Staff' },
  { value: 'Maintenance Staff', label: 'Maintenance Staff' },
];

export const DEPARTMENTS = [
  // Teaching Departments
  { value: 'Mathematics', label: 'Mathematics', category: 'Teaching Staff' },
  { value: 'Sciences', label: 'Sciences', category: 'Teaching Staff' },
  { value: 'Languages', label: 'Languages', category: 'Teaching Staff' },
  { value: 'Social Studies', label: 'Social Studies', category: 'Teaching Staff' },
  { value: 'Arts', label: 'Creative Arts', category: 'Teaching Staff' },
  { value: 'Physical Education', label: 'Physical Education', category: 'Teaching Staff' },
  { value: 'ICT', label: 'ICT', category: 'Teaching Staff' },
  
  // Administrative Departments
  { value: 'Administration', label: 'Administration', category: 'Administrative Staff' },
  { value: 'Finance', label: 'Finance & Accounts', category: 'Administrative Staff' },
  { value: 'Human Resources', label: 'Human Resources', category: 'Administrative Staff' },
  { value: 'Student Affairs', label: 'Student Affairs', category: 'Administrative Staff' },
  
  // Support Departments
  { value: 'Library', label: 'Library Services', category: 'Support Staff' },
  { value: 'IT Support', label: 'IT Support', category: 'Support Staff' },
  { value: 'Health Services', label: 'Health Services', category: 'Support Staff' },
  { value: 'Transport', label: 'Transport', category: 'Support Staff' },
  { value: 'Catering', label: 'Catering', category: 'Support Staff' },
  
  // Security & Maintenance
  { value: 'Security', label: 'Security', category: 'Security Staff' },
  { value: 'Maintenance', label: 'Maintenance', category: 'Maintenance Staff' },
  { value: 'Cleaning', label: 'Cleaning Services', category: 'Maintenance Staff' },
  { value: 'Grounds', label: 'Grounds Keeping', category: 'Maintenance Staff' },
];

export const JOB_TITLES = [
  // Teaching Staff
  { value: 'Teacher', label: 'Teacher', category: 'Teaching Staff' },
  { value: 'Senior Teacher', label: 'Senior Teacher', category: 'Teaching Staff' },
  { value: 'Head of Department', label: 'Head of Department', category: 'Teaching Staff' },
  { value: 'Deputy Principal', label: 'Deputy Principal', category: 'Teaching Staff' },
  { value: 'Principal', label: 'Principal', category: 'Teaching Staff' },
  { value: 'Academic Director', label: 'Academic Director', category: 'Teaching Staff' },
  
  // Administrative Staff
  { value: 'Administrator', label: 'Administrator', category: 'Administrative Staff' },
  { value: 'School Secretary', label: 'School Secretary', category: 'Administrative Staff' },
  { value: 'Accountant', label: 'Accountant', category: 'Administrative Staff' },
  { value: 'Bursar', label: 'Bursar', category: 'Administrative Staff' },
  { value: 'HR Officer', label: 'HR Officer', category: 'Administrative Staff' },
  { value: 'Registrar', label: 'Registrar', category: 'Administrative Staff' },
  
  // Support Staff
  { value: 'Librarian', label: 'Librarian', category: 'Support Staff' },
  { value: 'IT Technician', label: 'IT Technician', category: 'Support Staff' },
  { value: 'Lab Technician', label: 'Lab Technician', category: 'Support Staff' },
  { value: 'Nurse', label: 'School Nurse', category: 'Support Staff' },
  { value: 'Driver', label: 'Driver', category: 'Support Staff' },
  { value: 'Cook', label: 'Cook', category: 'Support Staff' },
  
  // Security & Maintenance
  { value: 'Security Guard', label: 'Security Guard', category: 'Security Staff' },
  { value: 'Watchman', label: 'Watchman', category: 'Security Staff' },
  { value: 'Maintenance Worker', label: 'Maintenance Worker', category: 'Maintenance Staff' },
  { value: 'Cleaner', label: 'Cleaner', category: 'Maintenance Staff' },
  { value: 'Gardener', label: 'Gardener', category: 'Maintenance Staff' },
];

// Backward compatibility
export const TEACHER_STATUS_OPTIONS = STAFF_STATUS_OPTIONS;

export const SALARY_SCALES = [
  { value: 'C1', label: 'C1 - Graduate Teacher' },
  { value: 'C2', label: 'C2 - Senior Teacher' },
  { value: 'C3', label: 'C3 - Principal Teacher' },
  { value: 'C4', label: 'C4 - Senior Principal Teacher' },
  { value: 'C5', label: 'C5 - Chief Principal Teacher' },
  { value: 'D1', label: 'D1 - Deputy Principal' },
  { value: 'D2', label: 'D2 - Principal' },
  { value: 'A1', label: 'A1 - Administrative Officer' },
  { value: 'A2', label: 'A2 - Senior Administrative Officer' },
  { value: 'S1', label: 'S1 - Support Staff Grade 1' },
  { value: 'S2', label: 'S2 - Support Staff Grade 2' },
];
