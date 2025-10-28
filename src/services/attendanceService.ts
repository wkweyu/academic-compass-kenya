import { supabase } from "@/integrations/supabase/client";
import { Attendance, AttendanceSummary, AttendanceFilters, AttendanceStatus } from "@/types/attendance";

/**
 * Mark attendance for a single student
 */
export const markAttendance = async (
  studentId: number,
  date: string,
  status: AttendanceStatus,
  options?: {
    classId?: number;
    streamId?: number;
    timeIn?: string;
    timeOut?: string;
    reason?: string;
    notes?: string;
  }
): Promise<Attendance> => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current term and year from settings or use defaults
    const currentYear = new Date().getFullYear();
    const currentTerm = getCurrentTerm();

    const attendanceData = {
      student_id: studentId,
      date,
      status,
      class_id: options?.classId || null,
      stream_id: options?.streamId || null,
      time_in: options?.timeIn || null,
      time_out: options?.timeOut || null,
      reason: options?.reason || null,
      notes: options?.notes || null,
      marked_by: user.id,
      academic_year: currentYear,
      term: currentTerm,
    };

    // Upsert to handle updates to existing records
    const { data, error } = await supabase
      .from('attendance')
      .upsert(attendanceData, {
        onConflict: 'student_id,date',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('No data returned');

    return transformAttendance(data);
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
};

/**
 * Bulk mark attendance for multiple students
 */
export const bulkMarkAttendance = async (
  attendanceRecords: Array<{
    studentId: number;
    date: string;
    status: AttendanceStatus;
    classId?: number;
    streamId?: number;
    reason?: string;
    notes?: string;
  }>
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const currentYear = new Date().getFullYear();
    const currentTerm = getCurrentTerm();

    const attendanceData = attendanceRecords.map(record => ({
      student_id: record.studentId,
      date: record.date,
      status: record.status,
      class_id: record.classId || null,
      stream_id: record.streamId || null,
      reason: record.reason || null,
      notes: record.notes || null,
      marked_by: user.id,
      academic_year: currentYear,
      term: currentTerm,
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(attendanceData, {
        onConflict: 'student_id,date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      result.failed = attendanceRecords.length;
      result.errors.push(error.message);
    } else {
      result.success = data?.length || 0;
    }

    return result;
  } catch (error: any) {
    result.failed = attendanceRecords.length;
    result.errors.push(error.message || 'Unknown error');
    return result;
  }
};

/**
 * Get attendance records with filters
 */
export const getAttendance = async (filters: AttendanceFilters = {}): Promise<Attendance[]> => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        students:student_id(id, full_name, admission_number),
        classes:class_id(id, name),
        streams:stream_id(id, name)
      `);

    if (filters.student_id) {
      query = query.eq('student_id', filters.student_id);
    }

    if (filters.class_id) {
      query = query.eq('class_id', filters.class_id);
    }

    if (filters.stream_id) {
      query = query.eq('stream_id', filters.stream_id);
    }

    if (filters.date_from) {
      query = query.gte('date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('date', filters.date_to);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.academic_year) {
      query = query.eq('academic_year', filters.academic_year);
    }

    if (filters.term) {
      query = query.eq('term', filters.term);
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformAttendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }
};

/**
 * Get attendance for a specific date and class/stream
 */
export const getAttendanceByDate = async (
  date: string,
  classId?: number,
  streamId?: number
): Promise<Attendance[]> => {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        students:student_id(id, full_name, admission_number),
        classes:class_id(id, name),
        streams:stream_id(id, name)
      `)
      .eq('date', date);

    if (classId) {
      query = query.eq('class_id', classId);
    }

    if (streamId) {
      query = query.eq('stream_id', streamId);
    }

    const { data, error } = await query.order('students(full_name)');

    if (error) throw error;

    return (data || []).map(transformAttendance);
  } catch (error) {
    console.error('Error fetching attendance by date:', error);
    throw error;
  }
};

/**
 * Get attendance summary for students
 */
export const getAttendanceSummary = async (
  studentIds?: number[],
  dateFrom?: string,
  dateTo?: string
): Promise<AttendanceSummary[]> => {
  try {
    let query = supabase
      .from('attendance_summary')
      .select('*');

    // Note: The view already filters by active students
    // Additional filtering would need to be done client-side or with a custom function

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(item => ({
      student_id: item.student_id,
      full_name: item.full_name,
      current_class_id: item.current_class_id,
      current_stream_id: item.current_stream_id,
      days_present: item.days_present || 0,
      days_absent: item.days_absent || 0,
      days_late: item.days_late || 0,
      days_excused: item.days_excused || 0,
      total_days: item.total_days || 0,
      attendance_percentage: item.attendance_percentage || 0,
    }));
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
};

/**
 * Get attendance statistics for a class/stream
 */
export const getAttendanceStats = async (
  classId?: number,
  streamId?: number,
  dateFrom?: string,
  dateTo?: string
) => {
  try {
    let query = supabase
      .from('attendance')
      .select('status, date, student_id');

    if (classId) query = query.eq('class_id', classId);
    if (streamId) query = query.eq('stream_id', streamId);
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);

    const { data, error } = await query;

    if (error) throw error;

    // Calculate statistics
    const stats = {
      total_records: data?.length || 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      sick: 0,
      left_early: 0,
      unique_students: new Set<number>(),
      unique_dates: new Set<string>(),
    };

    data?.forEach(record => {
      stats[record.status as keyof typeof stats]++;
      stats.unique_students.add(record.student_id);
      stats.unique_dates.add(record.date);
    });

    return {
      ...stats,
      unique_students_count: stats.unique_students.size,
      unique_dates_count: stats.unique_dates.size,
      attendance_rate: stats.total_records > 0 
        ? ((stats.present / stats.total_records) * 100).toFixed(2)
        : '0.00',
    };
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    throw error;
  }
};

/**
 * Delete attendance record
 */
export const deleteAttendance = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Error deleting attendance:', error);
    throw error;
  }
};

// Helper functions

function transformAttendance(data: any): Attendance {
  return {
    id: data.id,
    student_id: data.student_id,
    class_id: data.class_id,
    stream_id: data.stream_id,
    date: data.date,
    status: data.status,
    time_in: data.time_in,
    time_out: data.time_out,
    reason: data.reason,
    marked_by: data.marked_by,
    notes: data.notes,
    academic_year: data.academic_year,
    term: data.term,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function getCurrentTerm(): 1 | 2 | 3 {
  const month = new Date().getMonth() + 1; // 1-12
  
  // Term 1: January - April
  if (month >= 1 && month <= 4) return 1;
  
  // Term 2: May - August
  if (month >= 5 && month <= 8) return 2;
  
  // Term 3: September - December
  return 3;
}

/**
 * Export attendance data to CSV
 */
export const exportAttendanceToCSV = async (filters: AttendanceFilters = {}): Promise<Blob> => {
  const attendance = await getAttendance(filters);

  const headers = [
    'Date',
    'Admission Number',
    'Student Name',
    'Class',
    'Stream',
    'Status',
    'Time In',
    'Time Out',
    'Reason',
    'Notes'
  ];

  const rows = attendance.map(record => [
    record.date,
    record.student_id,
    '', // Student name from joined data
    '', // Class name
    '', // Stream name
    record.status,
    record.time_in || '',
    record.time_out || '',
    record.reason || '',
    record.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};
