// Class Management Types for Comprehensive School Administration

export interface Class {
  id: number;
  name: string;
  grade_level: number;
  description?: string;
  school: number;
  created_at: string;
  // Computed fields
  total_streams?: number;
  total_students?: number;
  capacity?: number;
}

export interface Stream {
  id: number;
  name: string;
  class_assigned: number;
  class_name?: string;
  year: number;
  school: number;
  capacity: number;
  current_enrollment: number;
  created_at: string;
  // Teacher assignment
  class_teacher?: number;
  class_teacher_name?: string;
  status: 'active' | 'archived';
}

export interface ClassAllocation {
  id: string;
  student_id: string;
  student_name?: string;
  student_admission_no?: string;
  class_id: number;
  stream_id: number;
  academic_year: number;
  term: 1 | 2 | 3;
  date_assigned: string;
  status: 'current' | 'promoted' | 'transferred' | 'suspended';
  created_by?: string;
}

export interface ClassSubjectAllocation {
  id: number;
  academic_year: number;
  term: 1 | 2 | 3;
  school_class: number;
  stream: number;
  subject: number;
  subject_name?: string;
  subject_teacher?: number;
  subject_teacher_name?: string;
  class_teacher?: number;
  class_teacher_name?: string;
}

export interface ClassFilters {
  search?: string;
  grade_level?: number;
  academic_year?: number;
  status?: 'active' | 'archived';
  class_teacher?: number;
}

export interface StreamFilters {
  search?: string;
  class_id?: number;
  academic_year?: number;
  status?: 'active' | 'archived';
  has_capacity?: boolean;
}

export interface ClassStats {
  total_classes: number;
  total_streams: number;
  total_students_enrolled: number;
  average_class_size: number;
  capacity_utilization: number;
  classes_by_grade: { [key: number]: number };
  enrollment_by_year: { year: number; count: number }[];
}

export interface BulkPromotionRequest {
  from_class_id: number;
  to_class_id: number;
  academic_year: number;
  student_ids?: string[];
  promotion_date: string;
  notes?: string;
}

export interface ClassTransferRequest {
  student_id: string;
  from_class_id: number;
  from_stream_id: number;
  to_class_id: number;
  to_stream_id: number;
  transfer_date: string;
  reason: string;
}

export const CLASS_GROUPS = [
  { value: 'pre-primary', label: 'Pre-Primary', levels: [1, 2] },
  { value: 'lower-primary', label: 'Lower Primary', levels: [1, 2, 3] },
  { value: 'upper-primary', label: 'Upper Primary', levels: [4, 5, 6, 7, 8] },
  { value: 'secondary', label: 'Secondary', levels: [9, 10, 11, 12] },
];

export const STREAM_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-800' },
];

export const ALLOCATION_STATUS_OPTIONS = [
  { value: 'current', label: 'Current', color: 'bg-blue-100 text-blue-800' },
  { value: 'promoted', label: 'Promoted', color: 'bg-green-100 text-green-800' },
  { value: 'transferred', label: 'Transferred', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'suspended', label: 'Suspended', color: 'bg-red-100 text-red-800' },
];