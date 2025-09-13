import { api } from "@/api/api";
import { Student, StudentFilters, StudentStats, ImportResult } from "@/types/student";
// import { createOrUpdateGuardian, getSiblings } from "./guardianService";

export const getStudents = async (
  params: StudentFilters = {}
): Promise<{ data: Student[]; total: number; page: number; limit: number }> => {
  const response = await api.get('/students/', params);
  const data = response.data;
  return {
    data: data.results,
    total: data.count,
    page: params.page || 1,
    limit: params.limit || 10,
  };
};

export const getStudentById = async (id: string): Promise<Student | null> => {
  const response = await api.get(`/students/${id}/`);
  const student = response.data;
  // const siblings = await getSiblings(id);
  return {
    ...student,
    // siblings,
  };
};

export const createStudent = async (
  studentData: Omit<Student, "id" | "admission_number" | "created_at" | "updated_at">
): Promise<Student> => {
  // const guardianResult = await createOrUpdateGuardian({
  //   name: studentData.guardian_name,
  //   phone: studentData.guardian_phone,
  //   email: studentData.guardian_email,
  //   address: studentData.guardian_address,
  //   relationship: studentData.guardian_relationship,
  // }, "");

  const response = await api.post('/students/', {
    ...studentData,
    // guardian_id: guardianResult.guardian.id,
  });
  const newStudent = response.data;
  // const siblings = await getSiblings(newStudent.id);
  return {
    ...newStudent,
    // siblings,
  };
};

export const updateStudent = async (id: string, studentData: Partial<Student>): Promise<Student | null> => {
  // if (studentData.guardian_name || studentData.guardian_phone || studentData.guardian_email) {
  //   const guardianResult = await createOrUpdateGuardian({
  //     name: studentData.guardian_name,
  //     phone: studentData.guardian_phone,
  //     email: studentData.guardian_email,
  //     address: studentData.guardian_address,
  //     relationship: studentData.guardian_relationship,
  //   }, id);
  //   studentData.guardian_id = guardianResult.guardian.id;
  // }

  const response = await api.patch(`/students/${id}/`, studentData);
  const updatedStudent = response.data;
  // const siblings = await getSiblings(id);
  return {
    ...updatedStudent,
    // siblings,
  };
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  await api.delete(`/students/${id}/`);
  return true;
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
