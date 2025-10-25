import { api } from "@/api/api";
import { SchoolProfile, TermSetting, AcademicYearSetting, SystemSettings, GradingSystemSettings } from "@/types/settings";

export const settingsService = {
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      const response = await api.get<SchoolProfile>("/schools/");
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  },

  createSchoolProfile: async (profile: Omit<SchoolProfile, "id" | "code" | "created_at" | "active">): Promise<SchoolProfile> => {
    const response = await api.post<SchoolProfile>("/schools/create/", profile);
    return response.data;
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    const response = await api.put<SchoolProfile>(`/schools/`, profile);
    return response.data;
  },

  deleteSchoolProfile: async (schoolId: number): Promise<void> => {
    await api.delete(`/schools/`);
  },

  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    // TODO: Implement backend endpoint
    return [];
  },

  createTermSetting: async (term: Omit<TermSetting, "id" | "school">): Promise<TermSetting> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },

  updateTermSetting: async (id: number, term: Partial<TermSetting>): Promise<TermSetting> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },

  deleteTermSetting: async (id: number): Promise<void> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },

  // Academic Years
  getAcademicYears: async (): Promise<AcademicYearSetting[]> => {
    // TODO: Implement backend endpoint
    return [];
  },

  setCurrentAcademicYear: async (yearId: number): Promise<void> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },

  // System Settings
  getSystemSettings: async (): Promise<SystemSettings> => {
    // TODO: Implement backend endpoint
    return {
      default_currency: 'KSH',
      late_payment_penalty_rate: 5,
      auto_generate_invoices: true,
      mpesa_integration_enabled: false,
      backup_frequency: 'daily',
      session_timeout_minutes: 30,
    };
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },

  // Grading Settings
  getGradingSettings: async (): Promise<GradingSystemSettings> => {
    // TODO: Implement backend endpoint
    return {
      grading_system: 'CBC',
      pass_mark: 50,
      grade_boundaries: {
        A: 80,
        B: 70,
        C: 60,
        D: 50,
        E: 40,
      },
    };
  },

  updateGradingSettings: async (settings: Partial<GradingSystemSettings>): Promise<GradingSystemSettings> => {
    // TODO: Implement backend endpoint
    throw new Error("Not implemented yet");
  },
};