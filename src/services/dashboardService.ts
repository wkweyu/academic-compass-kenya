import { api } from "@/api/api";
import { DashboardData } from "@/types/dashboard";

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    try {
      const response = await api.get("/dashboard/");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Return default data structure
      return {
        stats: {
          totalExams: 0,
          activeExams: 0,
          totalStudents: 0,
          totalSubjects: 0,
          completedScores: 0,
          pendingResults: 0,
        },
        recentExams: [],
        performanceData: [],
      };
    }
  },
};
