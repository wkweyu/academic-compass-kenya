import { api } from "@/api/api";
import { DashboardData } from '@/types/dashboard';

export const dashboardService = {
  async getDashboardData(): Promise<DashboardData> {
    const response = await api.get('/dashboard/');
    const data = response.data;
    return data;
  },
};
