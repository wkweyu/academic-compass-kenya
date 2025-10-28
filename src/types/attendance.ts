// Attendance Types for Daily Tracking

export interface Attendance {
  id: string;
  student_id: number;
  class_id?: number;
  stream_id?: number;
  date: string;
  status: AttendanceStatus;
  time_in?: string;
  time_out?: string;
  reason?: string;
  marked_by?: number;
  notes?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 
  | 'present' 
  | 'absent' 
  | 'late' 
  | 'excused' 
  | 'sick' 
  | 'left_early';

export interface AttendanceSummary {
  student_id: number;
  full_name: string;
  current_class_id?: number;
  current_stream_id?: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_excused: number;
  total_days: number;
  attendance_percentage: number;
}

export interface AttendanceFilters {
  student_id?: number;
  class_id?: number;
  stream_id?: number;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus;
  academic_year?: number;
  term?: number;
}

export const ATTENDANCE_STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  color: string;
  icon: string;
}[] = [
  { value: 'present', label: 'Present', color: 'bg-green-100 text-green-800', icon: '✓' },
  { value: 'absent', label: 'Absent', color: 'bg-red-100 text-red-800', icon: '✗' },
  { value: 'late', label: 'Late', color: 'bg-yellow-100 text-yellow-800', icon: '⏰' },
  { value: 'excused', label: 'Excused', color: 'bg-blue-100 text-blue-800', icon: '📋' },
  { value: 'sick', label: 'Sick', color: 'bg-orange-100 text-orange-800', icon: '🏥' },
  { value: 'left_early', label: 'Left Early', color: 'bg-purple-100 text-purple-800', icon: '🏃' },
];
