export interface TeachingAssignment {
  id: number;
  teacher_id: number;
  teacher_name?: string;
  subject_id: number;
  subject_name?: string;
  class_id: number;
  class_name?: string;
  stream_id?: number;
  stream_name?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  is_class_teacher: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeachingAssignmentFilters {
  teacher_id?: number;
  subject_id?: number;
  class_id?: number;
  stream_id?: number;
  academic_year?: number;
  term?: 1 | 2 | 3;
  is_class_teacher?: boolean;
}