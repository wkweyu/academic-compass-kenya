import { supabase } from '@/integrations/supabase/client';
import { Attendance } from '@/types/attendance';

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
  }
};
