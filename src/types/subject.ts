export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  grade_levels: number[]; // Keep as number[] but handle string conversion in components
  created_at: string;
  updated_at: string;
}

export interface SubjectFilters {
  grade_level?: number;
  is_core?: boolean;
  search?: string;
}

export interface SubjectStats {
  total_subjects: number;
  core_subjects: number;
  elective_subjects: number;
  subjects_by_grade: { [grade: string]: number };
}