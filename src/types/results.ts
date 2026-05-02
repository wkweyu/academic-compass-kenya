export interface StudentResult {
  id: number;
  student_id: number;
  admission_number: string; // Add missing property for component compatibility
  full_name: string; // Add missing property for component compatibility
  student_name: string;
  class_name: string;
  stream: string; // Add missing property for component compatibility
  term: number;
  year: number;
  total_marks: number; // Add missing property for component compatibility
  average_marks: number; // Add missing property for component compatibility
  grade: string; // Add missing property for component compatibility
  position: number; // Add missing property for component compatibility
  subjects: SubjectResult[];
  overall_grade: string;
  overall_points: number;
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