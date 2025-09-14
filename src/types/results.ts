export interface StudentResult {
  id: number;
  student_id: number;
  student_name: string;
  class_name: string;
  term: number;
  year: number;
  subjects: SubjectResult[];
  overall_grade: string;
  overall_points: number;
  position: number;
  created_at: string;
}

export interface SubjectResult {
  subject_name: string;
  marks: number;
  grade: string;
  points: number;
}

export interface ResultStats {
  total_students: number;
  class_average: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: { [grade: string]: number };
}