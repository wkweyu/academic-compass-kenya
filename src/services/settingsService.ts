import { api } from "@/api/api";
import { SchoolProfile } from "@/types/settings";

export const settingsService = {
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      const response = await api.get("/schools/");
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  },

  createSchoolProfile: async (profile: Omit<SchoolProfile, "id" | "code" | "created_at" | "active">): Promise<SchoolProfile> => {
    const response = await api.post("/schools/create/", profile);
    return response.data;
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    const response = await api.put(`/schools/`, profile);
    return response.data;
  },

  deleteSchoolProfile: async (schoolId: number): Promise<void> => {
    await api.delete(`/schools/`);
  },
};