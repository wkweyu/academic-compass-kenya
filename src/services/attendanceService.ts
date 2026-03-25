import { supabase } from '@/integrations/supabase/client';

import { api, resolveApiBaseUrl } from '@/api/api';
import {
  Attendance,
  AttendanceReportResponse,
  AttendanceSmsLog,
  BiometricDevice,
  BiometricLogEntry,
  BiometricSettings,
} from '@/types/attendance';

export const attendanceService = {
  async getAttendanceByDate(date: string, classId?: number, streamId?: number) {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('date', date);

    if (classId) query = query.eq('class_id', classId);
    if (streamId) query = query.eq('stream_id', streamId);

    const { data, error } = await query;
    if (error) throw error;
    return data as Attendance[];
  },

  async markAttendance(records: Partial<Attendance>[]) {
    const { data, error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id,date' });
    
    if (error) throw error;
    return data;
  },

  async getBiometricSettings(): Promise<BiometricSettings> {
    const response = await api.get<BiometricSettings>('attendance/biometric/settings/');
    return response.data;
  },

  async updateBiometricSettings(payload: BiometricSettings): Promise<BiometricSettings> {
    const response = await api.put<BiometricSettings>('attendance/biometric/settings/', payload);
    return response.data;
  },

  async getBiometricDevices(): Promise<BiometricDevice[]> {
    const response = await api.get<BiometricDevice[]>('attendance/biometric/devices/');
    return response.data;
  },

  async createBiometricDevice(payload: Partial<BiometricDevice>): Promise<BiometricDevice> {
    const response = await api.post<BiometricDevice>('attendance/biometric/devices/', payload);
    return response.data;
  },

  async updateBiometricDevice(deviceId: number, payload: Partial<BiometricDevice>): Promise<BiometricDevice> {
    const response = await api.patch<BiometricDevice>(`attendance/biometric/devices/${deviceId}/`, payload);
    return response.data;
  },

  async deleteBiometricDevice(deviceId: number): Promise<void> {
    await api.delete(`attendance/biometric/devices/${deviceId}/`);
  },

  async testBiometricDevice(payload: { deviceId?: number; device_ip?: string; device_port?: number }) {
    const response = await api.post<{ success: boolean; message: string; latency_ms: number | null }>('attendance/biometric/test-connection/', payload);
    return response.data;
  },

  async getBiometricLogs(limit = 50): Promise<{ logs: BiometricLogEntry[]; sms_logs: AttendanceSmsLog[] }> {
    const response = await api.get<{ logs: BiometricLogEntry[]; sms_logs: AttendanceSmsLog[] }>('attendance/biometric/logs/', { limit });
    return response.data;
  },

  async getBiometricReports(params?: { start_date?: string; end_date?: string; class_id?: number; stream_id?: number; student_id?: number }): Promise<AttendanceReportResponse> {
    const response = await api.get<AttendanceReportResponse>('attendance/biometric/reports/', params || {});
    return response.data;
  },

  async markAbsentStudents(date?: string): Promise<{ created_count: number }> {
    const response = await api.post<{ created_count: number }>('attendance/biometric/mark-absences/', date ? { date } : {});
    return response.data;
  },

  async exportBiometricAttendance(params?: { start_date?: string; end_date?: string }): Promise<Blob> {
    const search = new URLSearchParams();
    if (params?.start_date) search.set('start_date', params.start_date);
    if (params?.end_date) search.set('end_date', params.end_date);

    const headers: Record<string, string> = {};
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.Authorization = `Token ${token}`;
      }
    }

    const response = await fetch(`${resolveApiBaseUrl()}/api/attendance/biometric/export/${search.toString() ? `?${search.toString()}` : ''}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to export attendance CSV');
    }

    return await response.blob();
  },
};
