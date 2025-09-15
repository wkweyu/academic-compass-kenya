import { api } from "@/api/api";
import { DashboardData } from "@/types/dashboard";

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    try {
      const response = await api.get("/dashboard/");
      console.log("Raw dashboard response:", response.data);

      const data = response.data || {};

      // Handle field name variations - both "stats" and "static"
      const statsData = (data as any)?.stats || (data as any)?.static || {};

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
        recentExams: (data as any)?.recentExams || [],
        performanceData: (data as any)?.performanceData || [],
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

export async function getDashboardStats() {
  try {
    const response = await api.get("/dashboard/");
    const data = response.data as any;
    
    // Provide fallback values for missing properties
    return {
      totalStudents: data?.stats?.totalStudents || data?.totalStudents || 0,
      totalExams: data?.stats?.totalExams || data?.totalExams || 0, 
      activeExams: data?.stats?.activeExams || data?.activeExams || 0,
      totalSubjects: data?.stats?.totalSubjects || data?.totalSubjects || 0,
      completedScores: data?.stats?.completedScores || data?.completedScores || 0,
      recentExams: data?.recentExams || [],
      performanceData: data?.performanceData || [],
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return fallback data structure
    return {
      totalStudents: 0,
      totalExams: 0,
      activeExams: 0,
      totalSubjects: 0,
      completedScores: 0,
      recentExams: [],
      performanceData: [],
    };
  }
}