import { api } from "@/api/api";
import { Student } from '@/types/student';
import { Score } from '@/types/score';
import { Exam } from '@/types/exam';

export const scoreService = {
  async getExams(): Promise<Exam[]> {
    try {
      const response = await api.get('/exams/');
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
      return [];
    }
  },

  async getStudentsForExam(examId: number): Promise<Student[]> {
    try {
      const response = await api.get(`/exams/${examId}/students/`);
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching students for exam:', error);
      return [];
    }
  },

  async getScores(examId: number): Promise<Score[]> {
    try {
      const response = await api.get('/scores/', { exam_id: examId });
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
      return [];
    }
  },

  async saveScores(scores: Score[]): Promise<void> {
    try {
      await api.post('/scores/bulk_create/', scores);
    } catch (error) {
      console.error('Error saving scores:', error);
      throw error;
    }
  },

  async exportScores(examId: number): Promise<Blob> {
    try {
      const response = await api.get(`/scores/export/`, { exam_id: examId });
      const data = await response.data;
      return new Blob([data as BlobPart], { type: 'text/csv' });
    } catch (error) {
      console.error('Error exporting scores:', error);
      throw error;
    }
  }
};