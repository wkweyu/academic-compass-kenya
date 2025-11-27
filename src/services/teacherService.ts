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
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('staffService.getStaff response:', data);
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
        date_joined: data.hire_date, // Required field in database
        is_active: true, // Set active status
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
      // Map fields to match database schema
      const mappedData: any = { ...data };
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

  // Subject assignments (mainly for teaching staff)
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

  async assignStaffToSubject(staffId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<StaffSubjectAssignment> {
    try {
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

  // Attendance operations
  async getStaffAttendance(staffId: number, startDate?: string, endDate?: string) {
    try {
      let query = supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', staffId)
        .order('date', { ascending: false });
      
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
      const { data, error } = await supabase
        .from('staff_attendance')
        .upsert(attendance, {
          onConflict: 'staff_id,date'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking staff attendance:', error);
      throw error;
    }
  },

  async getStaffAttendanceStats(staffId: number, year?: number) {
    try {
      const currentYear = year || new Date().getFullYear();
      const { data, error } = await supabase
        .from('staff_attendance')
        .select('status')
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
        attendance_rate: 0,
      };
      
      if (stats.total_days > 0) {
        stats.attendance_rate = ((stats.present + stats.late) / stats.total_days) * 100;
      }
      
      return stats;
    } catch (error) {
      console.error('Error fetching staff attendance stats:', error);
      throw error;
    }
  },

  // Payroll operations (basic implementation)
  async getStaffPayroll(staffId: number, year?: number): Promise<PayrollTransaction[]> {
    // This would typically integrate with a payroll system
    // For now, return empty array as placeholder
    console.log('Payroll not yet fully implemented for:', staffId, year);
    return [];
  },

  async generatePayslip(staffId: number, month: number, year: number): Promise<PayrollTransaction> {
    // This would generate a payslip based on staff salary and deductions
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
      
      // Calculate staff by department
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
      
      // Calculate average years of service
      const currentDate = new Date();
      let totalYears = 0;
      data?.forEach(staff => {
        const hireDate = new Date(staff.hire_date || staff.date_joined);
        const years = (currentDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        totalYears += years;
      });
      const avgYears = data && data.length > 0 ? totalYears / data.length : 0;
      
      // Calculate total payroll cost
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
      
      // New hires this month
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