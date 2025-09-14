export interface Score {
  id?: number;
  student_id: number;
  student_name?: string;
  exam_id: number;
  marks_obtained: number;
  marks: number; // Make required to match component expectations
  grade?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}