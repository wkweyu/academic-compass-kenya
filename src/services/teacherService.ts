// @ts-nocheck
import { api } from "@/api/api";
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
    const response = await api.get('/teachers/', filters);
    const data = response.data;
    return data.results || data;
  },

  async getStaffMember(id: number): Promise<Staff | null> {
    try {
      const response = await api.get(`/teachers/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching staff member:', error);
      throw error;
    }
  },

  async createStaff(data: Omit<Staff, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Staff> {
    try {
      const response = await api.post('/teachers/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  },

  async updateStaff(id: number, data: Partial<Staff>): Promise<Staff | null> {
    try {
      const response = await api.patch(`/teachers/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  },

  async deleteStaff(id: number): Promise<boolean> {
    try {
      await api.delete(`/teachers/${id}/`);
      return true;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  },

  // Subject assignments (mainly for teaching staff)
  async getStaffSubjects(staffId: number): Promise<StaffSubjectAssignment[]> {
    const response = await api.get(`/staff/${staffId}/subjects/`);
    const data = response.data;
    return data;
  },

  async assignStaffToSubject(staffId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<StaffSubjectAssignment> {
    const response = await api.post(`/staff/${staffId}/subjects/`, {
      subject_id: subjectId,
      class_id: classId,
      stream_id: streamId,
      is_class_teacher: isClassTeacher,
    });
    const assignment = response.data;
    return assignment;
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
      const response = await api.get('/teachers/stats/');
      return {
        total_staff: response.data.total_teachers || 0,
        active_staff: response.data.active_teachers || 0,
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
      return {
        total_staff: 0,
        active_staff: 0,
        staff_by_department: {},
        staff_by_category: {},
        staff_by_employment_type: {},
        average_years_service: 0,
        total_payroll_cost: 0,
        staff_on_leave: 0,
        new_hires_this_month: 0,
      };
    }
  }
};

// Backward compatibility - Teacher service methods
export const teacherService = {
  async getTeachers(filters?: TeacherFilters): Promise<Teacher[]> {
    const staffFilters: StaffFilters = { ...filters, staff_category: 'Teaching Staff' };
    const response = await api.get('/teachers/', staffFilters);
    const data = response.data;
    return data.results;
  },

  async getTeacher(id: number): Promise<Teacher | null> {
    const response = await api.get(`/teachers/${id}/`);
    const data = response.data;
    return data;
  },

  async createTeacher(data: Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'full_name' | 'years_of_service' | 'gross_salary'>): Promise<Teacher> {
    const response = await api.post('/teachers/', data);
    const newTeacher = response.data;
    return newTeacher;
  },

  async updateTeacher(id: number, data: Partial<Teacher>): Promise<Teacher | null> {
    const response = await api.patch(`/teachers/${id}/`, data);
    const updatedTeacher = response.data;
    return updatedTeacher;
  },

  async deleteTeacher(id: number): Promise<boolean> {
    await api.delete(`/teachers/${id}/`);
    return true;
  },

  async getTeacherSubjects(teacherId: number): Promise<TeacherSubjectAssignment[]> {
    const response = await api.get(`/teachers/${teacherId}/subjects/`);
    const data = response.data;
    return data;
  },

  async assignTeacherToSubject(teacherId: number, subjectId: number, classId: number, streamId?: number, isClassTeacher: boolean = false): Promise<TeacherSubjectAssignment> {
    const response = await api.post(`/teachers/${teacherId}/subjects/`, {
      subject_id: subjectId,
      class_id: classId,
      stream_id: streamId,
      is_class_teacher: isClassTeacher,
    });
    const assignment = response.data;
    return assignment;
  },

  async getTeacherPayroll(teacherId: number, year?: number): Promise<PayrollTransaction[]> {
    // TODO: Implement this function
    console.log(teacherId, year);
    return [];
  },

  async generatePayslip(teacherId: number, month: number, year: number): Promise<PayrollTransaction> {
    // TODO: Implement this function
    console.log(teacherId, month, year);
    return {} as PayrollTransaction;
  },

  async getTeacherStats(): Promise<TeacherStats> {
    // TODO: Implement this function
    return {} as TeacherStats;
  }
};