export interface Attendance {
  id: number;
  student_id: number;
  class_id?: number;
  stream_id?: number;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  time_in?: string;
  time_out?: string;
  marked_by?: number;
  reason?: string;
  notes?: string;
  term?: number;
  academic_year?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  student_id: number;
  student_name: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  time_in?: string;
  notes?: string;
}

export interface BiometricSettings {
  biometric_enabled: boolean;
  attendance_mode: 'day' | 'boarding' | 'hybrid';
  check_in_cutoff_time: string;
  absence_mark_time: string;
  check_out_start_time: string;
  duplicate_scan_window_seconds: number;
  minimum_checkout_gap_minutes: number;
  auto_mark_absent: boolean;
  sms_enabled: boolean;
  send_check_in_sms: boolean;
  send_check_out_sms: boolean;
  send_absence_sms: boolean;
  sms_provider_name: string;
  sms_api_url: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_provider_scope?: 'school' | 'system' | 'unconfigured';
  sms_ready?: boolean;
  onboarding_warnings?: Array<{
    code: 'missing_device' | 'sms_fallback_active' | 'sms_not_configured' | 'boarding_mode_gate_only';
    level: 'info' | 'warning';
    message: string;
  }>;
  check_in_template: string;
  check_out_template: string;
  absence_template: string;
}

export interface BiometricDevice {
  id: number;
  device_name: string;
  device_ip: string;
  device_port: number;
  location: string;
  device_type: 'check_in' | 'check_out' | 'general';
  external_device_id: string;
  is_active: boolean;
  connection_status: 'unknown' | 'online' | 'offline' | 'error';
  last_seen_at: string | null;
  notes: string;
  metadata: Record<string, unknown>;
}

export interface BiometricLogEntry {
  id: number;
  student_id: number | null;
  student_name: string | null;
  device_id: number | null;
  device_name: string | null;
  identifier: string;
  scanned_at: string;
  event_type: string;
  processing_status: string;
  is_late: boolean;
  message: string;
}

export interface AttendanceSmsLog {
  id: number;
  student_name: string | null;
  recipient_phone: string;
  event_type: string;
  delivery_status: string;
  message: string;
  sent_at: string | null;
}

export interface AttendanceReportSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  missing_checkout: number;
}

export interface AttendanceReportResponse {
  summary: AttendanceReportSummary;
  daily_breakdown: Array<{ date: string; status: string; count: number }>;
  late_arrivals: Array<{ student_id: number; student__full_name: string; date: string; time_in: string | null }>;
  student_history: Array<{
    student_id: number;
    student__full_name: string;
    date: string;
    status: string;
    time_in: string | null;
    time_out: string | null;
    check_in_device__device_name: string | null;
    check_out_device__device_name: string | null;
  }>;
}
