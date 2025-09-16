// @ts-nocheck
import { api } from "@/api/api";
import { Student, StudentFilters, StudentStats, ImportResult } from "@/types/student";

export const getStudents = async (
  params: StudentFilters = {}
): Promise<Student[]> => {
  try {
    const response = await api.get('/api/students/students/', { params });
    const data = response.data as any;
    // Handle both paginated and direct array responses
    return Array.isArray(data) ? data : (data?.results || data?.data || []);
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

export const getStudentById = async (id: string): Promise<Student | null> => {
  try {
    const response = await api.get(`/api/students/students/${id}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student:', error);
    throw error;
  }
};

export const createStudent = async (
  studentData: Omit<Student, "id" | "admission_number" | "created_at" | "updated_at">
): Promise<Student> => {
  try {
    const response = await api.post('/api/students/students/', studentData);
    return response.data;
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
};

export const updateStudent = async (id: string, studentData: Partial<Student>): Promise<Student | null> => {
  try {
    const response = await api.patch(`/api/students/students/${id}/`, studentData);
    return response.data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  try {
    await api.delete(`/api/students/students/${id}/`);
    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    return false;
  }
};

export const getStudentStats = async (): Promise<StudentStats> => {
  // TODO: Implement this function
  // const response = await api.get('/students/stats/');
  // const data = JSON.parse(response.data as string);
  // return data;
  return {
    total_students: 0,
    active_students: 0,
    male_students: 0,
    female_students: 0,
    students_by_class: {},
    students_by_status: {},
    enrollment_trend: [],
  };
};

export const bulkImportStudents = async (file: File): Promise<ImportResult> => {
  // TODO: Implement this function
  console.log(file);
  return {
    success: 0,
    errors: 0,
    warnings: 0,
    details: [],
  };
};

export const exportStudents = async (filters: StudentFilters = {}): Promise<Blob> => {
  // TODO: Implement this function
  console.log(filters);
  const csvContent = "id,name\n1,John Doe";
  return new Blob([csvContent], { type: 'text/csv' });
};

export const getImportTemplate = (): Blob => {
  // TODO: Implement this function
  const csvContent = "id,name\n1,John Doe";
  return new Blob([csvContent], { type: 'text/csv' });
};
