// @ts-nocheck
import { api } from "@/api/api";
import { Subject, SubjectFilters, SubjectStats } from '@/types/subject';

export const subjectService = {
  async getSubjects(filters?: SubjectFilters): Promise<Subject[]> {
    try {
      const response = await api.get('/subjects/', filters);
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      return [];
    }
  },

  async getSubject(id: number): Promise<Subject | null> {
    try {
      const response = await api.get(`/subjects/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching subject:', error);
      return null;
    }
  },

  async createSubject(data: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    try {
      const response = await api.post('/subjects/', data);
      return response.data;
    } catch (error) {
      console.error('Error creating subject:', error);
      throw error;
    }
  },

  async updateSubject(id: number, data: Partial<Subject>): Promise<Subject | null> {
    try {
      const response = await api.patch(`/subjects/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating subject:', error);
      throw error; // Throw error instead of returning null
    }
  },

  async deleteSubject(id: number): Promise<boolean> {
    try {
      await api.delete(`/subjects/${id}/`);
      return true;
    } catch (error) {
      console.error('Error deleting subject:', error);
      return false;
    }
  },

  async getSubjectStats(): Promise<SubjectStats> {
    try {
      const response = await api.get('/subjects/stats/');
      return response.data;
    } catch (error) {
      console.error('Error fetching subject stats:', error);
      return {
        total_subjects: 0,
        core_subjects: 0,
        elective_subjects: 0,
        subjects_by_grade: {},
      };
    }
  }
};