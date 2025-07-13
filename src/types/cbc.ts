// CBC Exam Management System Types

export interface Student {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  class_assigned: string;
  stream: string;
  is_active: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_core: boolean;
  grade_levels: string;
}

export interface Exam {
  id: string;
  name: string;
  subject: Subject;
  class_assigned: string;
  stream?: string;
  term: 1 | 2 | 3;
  academic_year: number;
  exam_type: 'CAT' | 'MID' | 'END' | 'ANNUAL';
  exam_date: string;
  max_marks: number;
  duration_minutes: number;
  instructions?: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
}

export interface Score {
  id: string;
  student: Student;
  exam: Exam;
  subject: Subject;
  marks: number;
  grade: CBCGrade;
  teacher: string;
  timestamp: string;
}

export interface StudentExamResult {
  id: string;
  student: Student;
  exam: Exam;
  total_score: number;
  average_score: number;
  overall_grade: CBCGrade;
  class_position: number;
  remarks?: string;
  is_final: boolean;
}

export type CBCGrade = 'E' | 'V' | 'G' | 'A' | 'N';

export interface CBCGradeInfo {
  grade: CBCGrade;
  description: string;
  min_score: number;
  max_score: number;
  color: string;
}

export const CBC_GRADING_SCALE: CBCGradeInfo[] = [
  { grade: 'E', description: 'Excellent', min_score: 80, max_score: 100, color: 'text-green-600' },
  { grade: 'V', description: 'Very Good', min_score: 70, max_score: 79, color: 'text-blue-600' },
  { grade: 'G', description: 'Good', min_score: 60, max_score: 69, color: 'text-orange-600' },
  { grade: 'A', description: 'Average', min_score: 50, max_score: 59, color: 'text-yellow-600' },
  { grade: 'N', description: 'Needs Improvement', min_score: 0, max_score: 49, color: 'text-red-600' }
];

export const TERM_OPTIONS = [
  { value: 1, label: 'Term 1' },
  { value: 2, label: 'Term 2' },
  { value: 3, label: 'Term 3' }
];

export const EXAM_TYPE_OPTIONS = [
  { value: 'CAT', label: 'Continuous Assessment Test' },
  { value: 'MID', label: 'Mid-Term Exam' },
  { value: 'END', label: 'End-Term Exam' },
  { value: 'ANNUAL', label: 'Annual Exam' }
];

export const CLASS_OPTIONS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 
  'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'
];

export const STREAM_OPTIONS = [
  'EAST', 'WEST', 'NORTH', 'SOUTH', 'RED', 'BLUE', 'GREEN', 'YELLOW'
];