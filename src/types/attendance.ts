export interface Attendance {
  id: string;
  student_id: number;
  class_id: number;
  stream_id?: number;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  time_in?: string;
  time_out?: string;
  marked_by?: number;
  reason?: string;
  notes?: string;
  term: number;
  academic_year: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  student_id: number;
  student_name: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  time_in?: string;
  notes?: string;
}
