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
        query = query.eq('category', filters.staff_category);
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
    // TODO: Implement with Supabase
    console.log('getStaffSubjects not yet implemented for:', staffId);
    return [];
  },

  async assignStaffToSubject(staffId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<StaffSubjectAssignment> {
    // TODO: Implement with Supabase
    console.log('assignStaffToSubject not yet implemented:', { staffId, subjectId, classId, streamId, isClassTeacher });
    return {} as StaffSubjectAssignment;
  },

  // Payroll operations
  async getStaffPayroll(staffId: number, year?: number): Promise<PayrollTransaction[]> {
    // TODO: Implement this function
    console.log(staffId, year);
    return [];
  },

  async generatePayslip(staffId: number, month: number, year: number): Promise<PayrollTransaction> {
    // TODO: Implement this function
    console.log(staffId, month, year);
    return {} as PayrollTransaction;
  },

  // Statistics
  async getStaffStats(): Promise<StaffStats> {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*');
      
      if (error) throw error;
      
      const activeStaff = data?.filter(s => s.status === 'Active') || [];
      
      return {
        total_staff: data?.length || 0,
        active_staff: activeStaff.length,
        staff_by_department: {},
        staff_by_category: {},
        staff_by_employment_type: {},
        average_years_service: 0,
        total_payroll_cost: 0,
        staff_on_leave: 0,
        new_hires_this_month: 0,
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