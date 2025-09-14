export interface Exam {
  id: number;
  name: string;
  subject_id: number;
  subject_name?: string;
  subject?: string;
  subject_code?: string;
  class_id: number;
  class_name?: string;
  class_assigned?: string;
  stream_id?: number;
  stream_name?: string;
  stream?: string;
  exam_type: string;
  date: string;
  exam_date?: string;
  duration: number;
  duration_minutes?: number;
  max_marks: number;
  instructions?: string;
  is_published: boolean;
  term?: number;
  academic_year?: number;
  created_at: string;
  updated_at: string;
}

export interface ExamFilters {
  class_id?: number;
  subject_id?: number;
  exam_type?: string;
  is_published?: boolean;
  term?: number;
  search?: string;
}