import { supabase } from "@/integrations/supabase/client";
import { 
  Staff,
  Teacher,
  StaffSubjectAssignment,
  PayrollTransaction,
  StaffFilters,
  StaffStats,
  TeacherSubjectAssignment,
  TeacherFilters,
  TeacherStats
} from '@/types/teacher';

export interface TeacherSubjectSpecialization {
  id: number;
  teacher_id: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  qualification_level: string;
  is_primary_subject: boolean;
  years_experience: number;
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  staff_id: number;
  staff_name?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface TeacherWorkload {
  teacher_id: number;
  teacher_name: string;
  total_lessons: number;
  total_subjects: number;
  total_classes: number;
  weekly_limit: number;
  workload_percentage: number;
  is_overloaded: boolean;
  assignments: StaffSubjectAssignment[];
}

export const staffService = {
  // Staff CRUD operations
  async getStaff(filters?: StaffFilters): Promise<Staff[]> {
    console.log('staffService.getStaff called with filters:', filters);
    try {
      let query = supabase.from('teachers').select('*');
      
      // Apply filters if provided
      if (filters?.search) {
        query = query.or(`full_name.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,employee_no.ilike.%${filters.search}%`);
      }
      if (filters?.department) {
        query = query.eq('department', filters.department);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.employment_type) {
        query = query.eq('employment_type', filters.employment_type);
      }
      if (filters?.staff_category) {
        query = query.eq('staff_category', filters.staff_category);
      }
      
      const { data, error } = await query.order('full_name');
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('staffService.getStaff response:', data?.length, 'staff members');
      return data || [];
    } catch (error) {
      console.error('staffService.getStaff error:', error);
      throw error;
    }
  },

  async getStaffMember(id: number): Promise<Staff | null> {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching staff member:', error);
      throw error;
    }
  },

  async createStaff(data: Omit<Staff, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Staff> {
    console.log('staffService.createStaff called with data:', data);
    try {
      const now = new Date().toISOString();
      // Map fields to match database schema
      const mappedData = {
        ...data,
        gender: data.gender === 'Male' ? 'M' : data.gender === 'Female' ? 'F' : data.gender,
        date_joined: data.hire_date,
        is_active: true,
        created_at: now,
        updated_at: now
      };
      
      const { data: newStaff, error } = await supabase
        .from('teachers')
        .insert([mappedData])
        .select()
        .single();
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('staffService.createStaff response:', newStaff);
      return newStaff;
    } catch (error: any) {
      console.error('staffService.createStaff error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: error
      });
      throw error;
    }
  },

  async updateStaff(id: number, data: Partial<Staff>): Promise<Staff | null> {
    try {
      const mappedData: any = { ...data, updated_at: new Date().toISOString() };
      if (data.gender) {
        mappedData.gender = data.gender === 'Male' ? 'M' : data.gender === 'Female' ? 'F' : data.gender;
      }
      if (data.hire_date) {
        mappedData.date_joined = data.hire_date;
      }
      
      const { data: updatedStaff, error } = await supabase
        .from('teachers')
        .update(mappedData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updatedStaff;
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  },

  async deleteStaff(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  },

  // Subject Specialization (subjects a teacher CAN teach)
  async getTeacherSubjectSpecializations(teacherId: number): Promise<TeacherSubjectSpecialization[]> {
    try {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .select(`
          *,
          subject:subjects(id, name, code)
        `)
        .eq('teacher_id', teacherId);
      
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        id: item.id,
        teacher_id: item.teacher_id,
        subject_id: item.subject_id,
        subject_name: item.subject?.name,
        subject_code: item.subject?.code,
        qualification_level: item.qualification_level,
        is_primary_subject: item.is_primary_subject,
        years_experience: item.years_experience,
        created_at: item.created_at
      }));
    } catch (error) {
      console.error('Error fetching teacher subjects:', error);
      throw error;
    }
  },

  async addTeacherSubjectSpecialization(teacherId: number, subjectId: number, isPrimary: boolean = false): Promise<TeacherSubjectSpecialization> {
    try {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .insert({
          teacher_id: teacherId,
          subject_id: subjectId,
          is_primary_subject: isPrimary,
          qualification_level: 'Qualified'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding teacher subject:', error);
      throw error;
    }
  },

  async removeTeacherSubjectSpecialization(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing teacher subject:', error);
      throw error;
    }
  },

  // Subject assignments (actual teaching assignments)
  async getStaffSubjects(staffId: number): Promise<StaffSubjectAssignment[]> {
    try {
      const { data, error } = await supabase
        .from('teacher_subject_assignments')
        .select(`
          *,
          subject:subjects(id, name, code),
          class:classes!class_assigned_id(id, name, grade_level),
          stream:streams(id, name)
        `)
        .eq('teacher_id', staffId)
        .eq('is_active', true);
      
      if (error) throw error;
      
      return (data || []).map((assignment: any) => ({
        id: assignment.id,
        staff_id: assignment.teacher_id,
        subject_id: assignment.subject_id,
        subject_name: assignment.subject?.name,
        class_id: assignment.class_assigned_id,
        class_name: assignment.class?.name,
        stream_id: assignment.stream_id,
        stream_name: assignment.stream?.name,
        academic_year: assignment.academic_year,
        term: assignment.term,
        is_class_teacher: assignment.is_class_teacher || false,
        created_at: assignment.created_at,
      }));
    } catch (error) {
      console.error('Error fetching staff subjects:', error);
      throw error;
    }
  },

  async assignStaffToSubject(
    staffId: number, 
    subjectId: number, 
    classId: number, 
    streamId?: number, 
    isClassTeacher: boolean = false
  ): Promise<StaffSubjectAssignment> {
    try {
      // First, check if teacher can teach this subject
      const { data: specializations } = await supabase
        .from('teacher_subjects')
        .select('id')
        .eq('teacher_id', staffId)
        .eq('subject_id', subjectId);
      
      if (!specializations || specializations.length === 0) {
        throw new Error('Teacher is not qualified to teach this subject. Please add subject specialization first.');
      }

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('teacher_subject_assignments')
        .insert({
          teacher_id: staffId,
          subject_id: subjectId,
          class_assigned_id: classId,
          stream_id: streamId || null,
          academic_year: currentYear,
          is_class_teacher: isClassTeacher,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as StaffSubjectAssignment;
    } catch (error) {
      console.error('Error assigning staff to subject:', error);
      throw error;
    }
  },

  async removeStaffSubject(assignmentId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('teacher_subject_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing staff subject:', error);
      throw error;
    }
  },

  // Workload tracking
  async getTeacherWorkload(teacherId: number): Promise<TeacherWorkload> {
    try {
      const [teacher, assignments] = await Promise.all([
        this.getStaffMember(teacherId),
        this.getStaffSubjects(teacherId)
      ]);

      if (!teacher) throw new Error('Teacher not found');

      const weeklyLimit = (teacher as any).weekly_workload_limit || 28;
      const totalLessons = assignments.length * 5; // Assuming 5 lessons per subject per week
      const uniqueSubjects = new Set(assignments.map(a => a.subject_id));
      const uniqueClasses = new Set(assignments.map(a => `${a.class_id}-${a.stream_id || 0}`));

      return {
        teacher_id: teacherId,
        teacher_name: teacher.full_name || `${teacher.first_name} ${teacher.last_name}`,
        total_lessons: totalLessons,
        total_subjects: uniqueSubjects.size,
        total_classes: uniqueClasses.size,
        weekly_limit: weeklyLimit,
        workload_percentage: Math.round((totalLessons / weeklyLimit) * 100),
        is_overloaded: totalLessons > weeklyLimit,
        assignments
      };
    } catch (error) {
      console.error('Error fetching teacher workload:', error);
      throw error;
    }
  },

  async getAllTeachersWorkload(): Promise<TeacherWorkload[]> {
    try {
      const teachers = await this.getStaff({ staff_category: 'Teaching Staff' });
      const workloads = await Promise.all(
        teachers.map(t => this.getTeacherWorkload(t.id))
      );
      return workloads;
    } catch (error) {
      console.error('Error fetching all teachers workload:', error);
      throw error;
    }
  },

  // Attendance operations
  async getStaffAttendance(staffId?: number, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('staff_attendance')
        .select(`
          *,
          staff:teachers!staff_id(id, full_name, first_name, last_name, employee_no)
        `)
        .order('date', { ascending: false });
      
      if (staffId) query = query.eq('staff_id', staffId);
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching staff attendance:', error);
      throw error;
    }
  },

  async getAttendanceForDate(date: string) {
    try {
      const { data, error } = await supabase
        .from('staff_attendance')
        .select(`
          *,
          staff:teachers!staff_id(id, full_name, first_name, last_name, employee_no, job_title)
        `)
        .eq('date', date);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching attendance for date:', error);
      throw error;
    }
  },

  async markStaffAttendance(attendance: {
    staff_id: number;
    date: string;
    status: string;
    check_in_time?: string;
    check_out_time?: string;
    leave_type?: string;
    notes?: string;
  }) {
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('staff_attendance')
        .select('id')
        .eq('staff_id', attendance.staff_id)
        .eq('date', attendance.date)
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('staff_attendance')
          .update({
            status: attendance.status,
            check_in_time: attendance.check_in_time,
            check_out_time: attendance.check_out_time,
            leave_type: attendance.leave_type,
            notes: attendance.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('staff_attendance')
          .insert(attendance)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error marking staff attendance:', error);
      throw error;
    }
  },

  async bulkMarkAttendance(attendanceRecords: Array<{
    staff_id: number;
    date: string;
    status: string;
    check_in_time?: string;
    notes?: string;
  }>) {
    try {
      const results = await Promise.all(
        attendanceRecords.map(record => this.markStaffAttendance(record))
      );
      return results;
    } catch (error) {
      console.error('Error bulk marking attendance:', error);
      throw error;
    }
  },

  async getStaffAttendanceStats(staffId: number, year?: number) {
    try {
      const currentYear = year || new Date().getFullYear();
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('status, leave_type')
        .eq('staff_id', staffId)
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear}-12-31`);
      
      if (error) throw error;
      
      const stats = {
        total_days: data?.length || 0,
        present: data?.filter(d => d.status === 'Present').length || 0,
        absent: data?.filter(d => d.status === 'Absent').length || 0,
        late: data?.filter(d => d.status === 'Late').length || 0,
        on_leave: data?.filter(d => d.status === 'On Leave').length || 0,
        half_day: data?.filter(d => d.status === 'Half Day').length || 0,
        attendance_rate: 0,
        leave_breakdown: {
          sick: data?.filter(d => d.leave_type === 'Sick').length || 0,
          annual: data?.filter(d => d.leave_type === 'Annual').length || 0,
          maternity: data?.filter(d => d.leave_type === 'Maternity').length || 0,
          study: data?.filter(d => d.leave_type === 'Study').length || 0,
          emergency: data?.filter(d => d.leave_type === 'Emergency').length || 0,
        }
      };
      
      if (stats.total_days > 0) {
        stats.attendance_rate = ((stats.present + stats.late + stats.half_day * 0.5) / stats.total_days) * 100;
      }
      
      return stats;
    } catch (error) {
      console.error('Error fetching staff attendance stats:', error);
      throw error;
    }
  },

  async getMonthlyAttendanceSummary(year: number, month: number) {
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('staff_attendance')
        .select(`
          staff_id,
          status,
          staff:teachers!staff_id(id, full_name, employee_no, department)
        `)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;

      // Group by staff
      const summary: { [key: number]: any } = {};
      data?.forEach(record => {
        const staffId = record.staff_id;
        if (!summary[staffId]) {
          summary[staffId] = {
            staff_id: staffId,
            staff_name: (record as any).staff?.full_name,
            employee_no: (record as any).staff?.employee_no,
            department: (record as any).staff?.department,
            present: 0,
            absent: 0,
            late: 0,
            on_leave: 0,
            total: 0
          };
        }
        summary[staffId].total++;
        if (record.status === 'Present') summary[staffId].present++;
        if (record.status === 'Absent') summary[staffId].absent++;
        if (record.status === 'Late') summary[staffId].late++;
        if (record.status === 'On Leave') summary[staffId].on_leave++;
      });

      return Object.values(summary);
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
      throw error;
    }
  },

  // Leave Management
  async getLeaveRequests(filters?: { staff_id?: number; status?: string }): Promise<LeaveRequest[]> {
    try {
      let query = supabase
        .from('leave_requests')
        .select(`
          *,
          staff:teachers!staff_id(id, full_name, employee_no)
        `)
        .order('created_at', { ascending: false });
      
      if (filters?.staff_id) query = query.eq('staff_id', filters.staff_id);
      if (filters?.status) query = query.eq('status', filters.status);
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        staff_name: item.staff?.full_name
      }));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      throw error;
    }
  },

  async createLeaveRequest(request: {
    staff_id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }): Promise<LeaveRequest> {
    try {
      const start = new Date(request.start_date);
      const end = new Date(request.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({
          ...request,
          days_requested: days,
          status: 'Pending'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  },

  async updateLeaveRequest(id: number, status: 'Approved' | 'Rejected', rejectionReason?: string): Promise<LeaveRequest> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'Approved') {
        updateData.approved_at = new Date().toISOString();
      }
      if (status === 'Rejected' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // If approved, mark attendance as On Leave for those days
      if (status === 'Approved' && data) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        const attendanceRecords = [];
        
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
          attendanceRecords.push({
            staff_id: data.staff_id,
            date: d.toISOString().split('T')[0],
            status: 'On Leave',
            leave_type: data.leave_type
          });
        }
        
        await this.bulkMarkAttendance(attendanceRecords);
      }

      return data;
    } catch (error) {
      console.error('Error updating leave request:', error);
      throw error;
    }
  },

  // HOD Management
  async setAsHOD(teacherId: number, isHod: boolean): Promise<Staff | null> {
    return this.updateStaff(teacherId, { is_hod: isHod } as any);
  },

  async getHODs(): Promise<Staff[]> {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('is_hod', true)
        .eq('staff_category', 'Teaching Staff');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching HODs:', error);
      throw error;
    }
  },

  // Class Teacher assignments
  async getClassTeachers(academicYear?: number): Promise<StaffSubjectAssignment[]> {
    try {
      const year = academicYear || new Date().getFullYear();
      const { data, error } = await supabase
        .from('teacher_subject_assignments')
        .select(`
          *,
          teacher:teachers!teacher_id(id, full_name, employee_no),
          class:classes!class_assigned_id(id, name, grade_level),
          stream:streams(id, name)
        `)
        .eq('is_class_teacher', true)
        .eq('academic_year', year)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching class teachers:', error);
      throw error;
    }
  },

  // Reports
  async getTeacherPerformanceReport(teacherId: number, academicYear: number) {
    try {
      // Get teacher's classes and their exam results
      const assignments = await this.getStaffSubjects(teacherId);
      
      // For now, return a basic structure
      // This would be expanded with actual exam data integration
      return {
        teacher_id: teacherId,
        academic_year: academicYear,
        classes_taught: assignments.length,
        subjects_taught: new Set(assignments.map(a => a.subject_id)).size,
        // Performance metrics would come from exam results
        class_performance: [],
        subject_performance: []
      };
    } catch (error) {
      console.error('Error fetching teacher performance:', error);
      throw error;
    }
  },

  // Payroll operations (basic implementation)
  async getStaffPayroll(staffId: number, year?: number): Promise<PayrollTransaction[]> {
    console.log('Payroll not yet fully implemented for:', staffId, year);
    return [];
  },

  async generatePayslip(staffId: number, month: number, year: number): Promise<PayrollTransaction> {
    console.log('Payslip generation not yet fully implemented:', staffId, month, year);
    return {} as PayrollTransaction;
  },

  // Statistics
  async getStaffStats(): Promise<StaffStats> {
    try {
      const { data, error} = await supabase
        .from('teachers')
        .select('*');
      
      if (error) throw error;
      
      const activeStaff = data?.filter(s => s.status === 'Active') || [];
      const onLeave = data?.filter(s => s.status === 'On Leave') || [];
      
      const byDepartment: { [key: string]: number } = {};
      const byCategory: { [key: string]: number } = {};
      const byEmploymentType: { [key: string]: number } = {};
      
      data?.forEach(staff => {
        if (staff.department) {
          byDepartment[staff.department] = (byDepartment[staff.department] || 0) + 1;
        }
        if (staff.staff_category) {
          byCategory[staff.staff_category] = (byCategory[staff.staff_category] || 0) + 1;
        }
        if (staff.employment_type) {
          byEmploymentType[staff.employment_type] = (byEmploymentType[staff.employment_type] || 0) + 1;
        }
      });
      
      const currentDate = new Date();
      let totalYears = 0;
      data?.forEach(staff => {
        const hireDate = new Date(staff.hire_date || staff.date_joined);
        const years = (currentDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        totalYears += years;
      });
      const avgYears = data && data.length > 0 ? totalYears / data.length : 0;
      
      let totalPayroll = 0;
      activeStaff.forEach(staff => {
        const gross = (
          (Number(staff.basic_salary) || 0) +
          (Number(staff.house_allowance) || 0) +
          (Number(staff.transport_allowance) || 0) +
          (Number(staff.responsibility_allowance) || 0) +
          (Number(staff.other_allowances) || 0)
        );
        totalPayroll += gross;
      });
      
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const newHires = data?.filter(staff => {
        const joinDate = new Date(staff.date_joined);
        return joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear;
      }).length || 0;
      
      return {
        total_staff: data?.length || 0,
        active_staff: activeStaff.length,
        staff_by_department: byDepartment,
        staff_by_category: byCategory,
        staff_by_employment_type: byEmploymentType,
        average_years_service: Math.round(avgYears * 10) / 10,
        total_payroll_cost: totalPayroll,
        staff_on_leave: onLeave.length,
        new_hires_this_month: newHires,
      };
    } catch (error) {
      console.error('Error fetching staff stats:', error);
      throw error;
    }
  }
};

// Backward compatibility - Teacher service methods
export const teacherService = {
  async getTeachers(filters?: TeacherFilters): Promise<Teacher[]> {
    const staffFilters: StaffFilters = { ...filters, staff_category: 'Teaching Staff' };
    return staffService.getStaff(staffFilters) as Promise<Teacher[]>;
  },

  async getTeacher(id: number): Promise<Teacher | null> {
    return staffService.getStaffMember(id) as Promise<Teacher | null>;
  },

  async createTeacher(data: Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Teacher> {
    const staffData = { ...data, staff_category: 'Teaching Staff' as const };
    return staffService.createStaff(staffData) as Promise<Teacher>;
  },

  async updateTeacher(id: number, data: Partial<Teacher>): Promise<Teacher | null> {
    return staffService.updateStaff(id, data) as Promise<Teacher | null>;
  },

  async deleteTeacher(id: number): Promise<boolean> {
    return staffService.deleteStaff(id);
  },

  async getTeacherSubjects(teacherId: number): Promise<TeacherSubjectAssignment[]> {
    return staffService.getStaffSubjects(teacherId);
  },

  async assignTeacherToSubject(teacherId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<TeacherSubjectAssignment> {
    return staffService.assignStaffToSubject(teacherId, subjectId, classId, streamId, isClassTeacher);
  },

  async getTeacherPayroll(teacherId: number, year?: number): Promise<PayrollTransaction[]> {
    return staffService.getStaffPayroll(teacherId, year);
  },

  async generatePayslip(teacherId: number, month: number, year: number): Promise<PayrollTransaction> {
    return staffService.generatePayslip(teacherId, month, year);
  },

  async getTeacherStats(): Promise<TeacherStats> {
    return staffService.getStaffStats();
  }
};