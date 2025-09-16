// Enhanced Student Types for Comprehensive Management

export interface Student {
  id: string;
  admission_number: string;
  level: string;
  
  // Personal Information
  full_name: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender: 'M' | 'F';
  date_of_birth: string;
  national_id?: string;
  birth_certificate_no?: string;
  upi_number?: string; // Government issued UPI number (unique but not mandatory)
  photo?: string | null;
  photo_url?: string | null; // Supabase field
  
  // Contact Information
  phone?: string;
  email?: string;
  address?: string;
  residence?: string;
  
  // Medical and Emergency Information
  medical_conditions?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  previous_school?: string;
  
  // Guardian Information
  guardian_id?: string; // Links to Guardian record
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string;
  guardian_relationship: string;
  guardian_address?: string;
  
  // Sibling Information
  siblings?: Student[]; // Other students with same guardian
  
  // Academic Information
  current_class: number;
  current_stream: number;
  current_class_name: string;
  current_stream_name: string;
  current_class_stream: string;
  admission_year: number;
  academic_year: number;
  term: 1 | 2 | 3;
  kcpe_index?: string;
  stream: string; // Add missing stream property
  
  // Transport Information
  is_on_transport: boolean;
  transport_route?: number;
  transport_type?: 'one_way' | 'two_way';
  
  // Status and Metadata
  status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'suspended';
  is_active: boolean;
  enrollment_date: string;
  special_needs?: string;
  notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: number;
  name: string;
  grade_level: number;
  description?: string;
  school: number;
}

export interface Stream {
  id: number;
  name: string;
  class_assigned: number;
  year: number;
  capacity: number;
  current_enrollment: number;
}

export interface StudentTransfer {
  id: string;
  student: string;
  from_class: number;
  from_stream: number;
  to_class: number;
  to_stream: number;
  transfer_date: string;
  reason: string;
  created_by: string;
}

export interface StudentPromotion {
  id: string;
  student: string;
  from_class: number;
  to_class: number;
  academic_year: number;
  promotion_date: string;
  notes: string;
  created_by: string;
}

export interface StudentFilters {
  search?: string;
  admission_number?: string;
  class?: string;
  class_id?: string; // Add Supabase field
  stream?: string;
  status?: string;
  academic_year?: number;
  gender?: 'M' | 'F';
  transport?: boolean;
}

export interface StudentStats {
  total_students: number;
  active_students: number;
  male_students: number;
  female_students: number;
  students_by_class: { [key: string]: number };
  students_by_status: { [key: string]: number };
  enrollment_trend: { year: number; count: number }[];
}

export interface ImportResult {
  success: number;
  errors: number;
  warnings: number;
  details: {
    row: number;
    message: string;
    type: 'error' | 'warning';
  }[];
}

export const STUDENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
  { value: 'graduated', label: 'Graduated', color: 'bg-blue-100 text-blue-800' },
  { value: 'transferred', label: 'Transferred', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800' },
];

export const GENDER_OPTIONS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
];

export const TRANSPORT_TYPE_OPTIONS = [
  { value: 'one_way', label: 'One Way' },
  { value: 'two_way', label: 'Two Way' },
];

export const GUARDIAN_RELATIONSHIP_OPTIONS = [
  'Parent',
  'Father',
  'Mother',
  'Guardian',
  'Grandparent',
  'Uncle',
  'Aunt',
  'Sibling',
  'Other',
];