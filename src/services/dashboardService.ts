import { api } from "@/api/api";
import { DashboardData } from "@/types/dashboard";

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    try {
      const response = await api.get("/dashboard/");
      console.log("Raw dashboard response:", response.data);

      const data = response.data || {};

      // Handle field name variations - both "stats" and "static"
      const statsData = data.stats || data.static || {};

      const result = {
        stats: {
          totalExams: statsData.totalExams || statsData.totalname || 0,
          activeExams: statsData.activeExams || statsData.activation || 0,
          totalStudents: statsData.totalStudents || statsData.totalStudent || 0,
          totalSubjects: statsData.totalSubjects || statsData.totalSubject || 0,
          completedScores:
            statsData.completedScores || statsData.combinReference || 0,
          pendingResults:
            statsData.pendingResults || statsData.modelupdate || 0,
        },
        recentExams: data.recentExams || [],
        performanceData: data.performanceData || [],
      };

      console.log("Processed dashboard data:", result);
      return result;
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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
