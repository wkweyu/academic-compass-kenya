// @ts-nocheck
import { api } from "@/api/api";
import { TeachingAssignment, CreateAssignmentData } from '@/types/teaching-assignment';

export const teachingAssignmentService = {
  async getAssignments(): Promise<TeachingAssignment[]> {
    const response = await api.get('/teaching-assignments/');
    const data = response.data;
    return data.results;
  },

  async getAssignment(id: number): Promise<TeachingAssignment | null> {
    const response = await api.get(`/teaching-assignments/${id}/`);
    const data = response.data;
    return data;
  },

  async getTeacherAssignments(teacherId: number): Promise<TeachingAssignment[]> {
    const response = await api.get('/teaching-assignments/', { teacher_id: teacherId });
    const data = response.data;
    return data.results;
  },

  async createAssignment(data: CreateAssignmentData): Promise<TeachingAssignment> {
    const response = await api.post('/teaching-assignments/', data);
    const newAssignment = response.data;
    return newAssignment;
  },

  async updateAssignment(id: number, data: Partial<CreateAssignmentData>): Promise<TeachingAssignment | null> {
    const response = await api.patch(`/teaching-assignments/${id}/`, data);
    const updatedAssignment = response.data;
    return updatedAssignment;
  },

  async deleteAssignment(id: number): Promise<boolean> {
    await api.delete(`/teaching-assignments/${id}/`);
    return true;
  }
};