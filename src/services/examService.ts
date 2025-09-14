import { api } from "@/api/api";
import { Exam, ExamFilters } from '@/types/cbc';

export const examService = {
  async getExams(filters?: ExamFilters): Promise<Exam[]> {
    const response = await api.get('/exams/', filters);
    const data = response.data;
    return data.results;
  },
};
