import { api } from "@/api/api";
import { Subject, SubjectFilters, SubjectStats } from '@/types/subject';

export const subjectService = {
  async getSubjects(filters?: SubjectFilters): Promise<Subject[]> {
    const response = await api.get('/subjects/', filters);
    const data = response.data;
    return data.results;
  },

  async getSubject(id: number): Promise<Subject | null> {
    const response = await api.get(`/subjects/${id}/`);
    const data = response.data;
    return data;
  },

  async createSubject(data: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    const response = await api.post('/subjects/', data);
    const newSubject = response.data;
    return newSubject;
  },

  async updateSubject(id: number, data: Partial<Subject>): Promise<Subject | null> {
    const response = await api.patch(`/subjects/${id}/`, data);
    const updatedSubject = response.data;
    return updatedSubject;
  },

  async deleteSubject(id: number): Promise<boolean> {
    await api.delete(`/subjects/${id}/`);
    return true;
  },

  async getSubjectStats(): Promise<SubjectStats> {
    // TODO: Implement this function
    return {
      total_subjects: 0,
      core_subjects: 0,
      elective_subjects: 0,
      subjects_by_grade: {},
    };
  }
};