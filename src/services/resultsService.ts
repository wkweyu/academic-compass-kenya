// @ts-nocheck
import { api } from "@/api/api";
import { StudentResult, ResultStats } from '@/types/results';

export const resultsService = {
  async getClassResults(className: string, term: number, year: number): Promise<StudentResult[]> {
    const response = await api.get('/results/', { class_name: className, term, year });
    const data = response.data;
    return data.results;
  },

  async getStudentResults(studentId: number, year: number): Promise<StudentResult[]> {
    const response = await api.get('/results/', { student_id: studentId, year });
    const data = response.data;
    return data.results;
  },

  async getResultsStats(className: string, term: number, year: number): Promise<ResultStats> {
    // TODO: Implement this function
    console.log(className, term, year);
    return {
      total_students: 0,
      class_average: 0,
      highest_score: 0,
      lowest_score: 0,
      grade_distribution: {}
    };
  },

  async exportResults(className: string, term: number, year: number): Promise<Blob> {
    // TODO: Implement this function
    console.log(className, term, year);
    const csvContent = "id,name\n1,John Doe";
    return new Blob([csvContent], { type: 'text/csv' });
  }
};