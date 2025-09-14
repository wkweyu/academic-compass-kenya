import { api } from "@/api/api";
import { Exam, ExamFilters } from "@/types/exam";

export const examService = {
  async getExams(filters?: ExamFilters): Promise<Exam[]> {
    const response = await api.get('/exams/', filters);
    return response.data.results || response.data;
  },
};
