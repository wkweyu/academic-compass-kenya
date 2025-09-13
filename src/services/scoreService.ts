import { api } from "@/api/api";
import { Student } from '@/types/student';
import { Score } from '@/types/score';
import { Exam } from '@/types/exam';

export const scoreService = {
  async getExams(): Promise<Exam[]> {
    const response = await api.get('/exams/');
    const data = response.data;
    return data.results;
  },

  async getStudentsForExam(examId: number): Promise<Student[]> {
    const response = await api.get(`/exams/${examId}/students/`);
    const data = response.data;
    return data;
  },

  async getScores(examId: number): Promise<Score[]> {
    const response = await api.get('/scores/', { exam_id: examId });
    const data = response.data;
    return data.results;
  },

  async saveScores(scores: Score[]): Promise<void> {
    await api.post('/scores/bulk_create/', scores);
  },

  async exportScores(examId: number): Promise<Blob> {
    const response = await api.get(`/scores/export/`, { exam_id: examId });
    const data = await response.data;
    return new Blob([data as BlobPart], { type: 'text/csv' });
  }
};