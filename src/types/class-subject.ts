// Class Subject Allocation Types

export interface ClassSubject {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number | null;
  school_id: number;
  is_active: boolean;
  is_examinable: boolean;
  is_compulsory: boolean;
  periods_per_week: number | null;
  subject_group_id: number | null;
  is_double: boolean;
  priority: number;
  requires_special_room: boolean;
  preferred_room_type: 'lab' | 'computer' | 'hall' | 'library' | 'other' | null;
  created_at: string;
  updated_at: string;
  // Joined data
  class?: {
    id: number;
    name: string;
    grade_level: number;
  };
  subject?: {
    id: number;
    name: string;
    code: string;
    is_core: boolean;
  };
  teacher?: {
    id: number;
    first_name: string;
    last_name: string;
    employee_no: string;
  };
  subject_group?: SubjectGroup;
}

export interface SubjectGroup {
  id: number;
  name: string;
  description: string;
  class_id: number;
  school_id: number;
  min_subjects: number;
  max_subjects: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  subjects?: ClassSubject[];
}

export interface StudentSubjectAllocation {
  id: number;
  student_id: number;
  class_subject_id: number;
  school_id: number;
  academic_year: number;
  term: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    id: number;
    full_name: string;
    admission_number: string;
  };
  class_subject?: ClassSubject;
}

export interface ClassSubjectFormData {
  subject_id: number;
  teacher_id?: number | null;
  is_examinable: boolean;
  is_compulsory: boolean;
  periods_per_week?: number;
  subject_group_id?: number | null;
  is_double?: boolean;
  priority?: number;
  requires_special_room?: boolean;
  preferred_room_type?: 'lab' | 'computer' | 'hall' | 'library' | 'other' | null;
}

export interface SubjectGroupFormData {
  name: string;
  description?: string;
  min_subjects: number;
  max_subjects: number;
}
