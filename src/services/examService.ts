import { api } from "@/api/api";
import { Exam, ExamFilters } from "@/types/exam";

export const examService = {
  async getExams(filters?: ExamFilters): Promise<Exam[]> {
    try {
      const response = await api.get('/exams/', filters);
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching exams:', error);
      return [];
    }
  },
};
