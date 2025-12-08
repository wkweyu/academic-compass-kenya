export interface SubjectCategory {
  id: number;
  name: string;
  description: string | null;
  school_id: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  is_active: boolean;
  category_id: number | null;
  category?: SubjectCategory;
  school_id: number | null;
  grade_levels: number[];
  created_at: string;
  updated_at: string;
  // Computed stats
  assigned_classes?: number;
  assigned_teachers?: number;
  total_exams?: number;
}

export interface ClassSubject {
  id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number | null;
  school_id: number;
  is_active: boolean;
  periods_per_week: number;
  created_at: string;
  updated_at: string;
  // Joined data
  class?: {
    id: number;
    name: string;
    grade_level: number;
  };
  subject?: Subject;
  teacher?: {
    id: number;
    first_name: string;
    last_name: string;
    employee_no: string;
  };
}

export interface SubjectFilters {
  grade_level?: number;
  is_core?: boolean;
  is_active?: boolean;
  category_id?: number;
  search?: string;
}

export interface SubjectStats {
  total_subjects: number;
  active_subjects: number;
  inactive_subjects: number;
  core_subjects: number;
  elective_subjects: number;
  subjects_by_grade: { [grade: string]: number };
  subjects_by_category: { [category: string]: number };
}

export interface SubjectDependencies {
  has_dependencies: boolean;
  class_count: number;
  teacher_count: number;
  exam_count: number;
}
