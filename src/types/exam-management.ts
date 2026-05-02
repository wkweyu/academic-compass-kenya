// Comprehensive Exam Management Types

export type ExamSessionStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';
export type ExamPaperStatus = 'draft' | 'published' | 'completed' | 'locked';

export interface ExamSession {
  id: number;
  school_id: number;
  name: string;
  description: string | null;
  term_id: number;
  term_number?: number;
  term_year?: number;
  academic_year: number;
  start_date: string;
  end_date: string;
  status: ExamSessionStatus;
  is_locked: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  // Computed fields
  classes_count?: number;
  papers_count?: number;
  completion_percentage?: number;
}

export interface ExamSessionClass {
  id: number;
  exam_session_id: number;
  class_id: number;
  class_name?: string;
  created_at: string;
}

export interface ExamPaper {
  id: number;
  exam_session_id: number;
  class_id: number;
  class_name?: string;
  stream_id: number | null;
  stream_name?: string | null;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  paper_name: string;
  max_marks: number;
  weight: number;
  exam_date: string | null;
  duration_minutes: number;
  instructions: string | null;
  status: ExamPaperStatus;
  created_at: string;
  updated_at: string;
  // Computed fields
  total_students?: number;
  marks_entered?: number;
  class_average?: number;
}

export interface ExamMark {
  id?: number;
  exam_paper_id: number;
  student_id: number;
  admission_number?: string;
  full_name?: string;
  marks: number | null;
  grade: string | null;
  points: number | null;
  is_absent: boolean;
  remarks: string | null;
  entered_by: number | null;
  is_submitted: boolean;
  submitted_at: string | null;
  submitted_by: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface StudentExamResult {
  id: number;
  exam_session_id: number;
  student_id: number;
  admission_number?: string;
  full_name?: string;
  class_id: number;
  class_name?: string;
  stream_id: number | null;
  stream_name?: string | null;
  total_marks: number;
  total_possible: number;
  average_percentage: number;
  total_points: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
  class_position: number | null;
  stream_position: number | null;
  subject_positions: Record<string, number>;
  teacher_comment: string | null;
  head_teacher_comment: string | null;
  is_published: boolean;
  computed_at: string | null;
}

export interface TeacherMarksProgress {
  id: number;
  exam_paper_id: number;
  teacher_id: number;
  teacher_name?: string;
  total_students: number;
  marks_entered: number;
  is_complete: boolean;
  completed_at: string | null;
}

export interface SubjectPerformance {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  paper_name: string;
  total_students: number;
  marks_entered: number;
  class_average: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: Record<string, number>;
  teacher_name?: string;
}

export interface ClassMeritListEntry {
  position: number;
  student_id: number;
  admission_number: string;
  full_name: string;
  class_name: string;
  stream_name: string | null;
  total_marks: number;
  total_possible: number;
  percentage: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
  stream_position?: number;
}

// Form types
export interface CreateExamSessionData {
  name: string;
  description?: string;
  term_id: number;
  academic_year: number;
  start_date: string;
  end_date: string;
  class_ids: number[];
}

export interface CreateExamPaperData {
  exam_session_id: number;
  class_id: number;
  stream_id?: number;
  subject_id: number;
  paper_name: string;
  max_marks: number;
  weight?: number;
  exam_date?: string;
  duration_minutes?: number;
  instructions?: string;
}

// CBC Grading
export const CBC_GRADES = {
  EE: { label: 'Exceeding Expectations', points: 4, color: 'text-green-600', bgColor: 'bg-green-100' },
  ME: { label: 'Meeting Expectations', points: 3, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  AE: { label: 'Approaching Expectations', points: 2, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  BE: { label: 'Below Expectations', points: 1, color: 'text-red-600', bgColor: 'bg-red-100' },
} as const;

export function calculateCBCGrade(marks: number, maxMarks: number): { grade: string; points: number } {
  if (maxMarks === 0) return { grade: 'BE', points: 1 };
  const percentage = (marks / maxMarks) * 100;
  
  if (percentage >= 75) return { grade: 'EE', points: 4 };
  if (percentage >= 50) return { grade: 'ME', points: 3 };
  if (percentage >= 25) return { grade: 'AE', points: 2 };
  return { grade: 'BE', points: 1 };
}
