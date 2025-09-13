import { api } from "@/api/api";
import { TermSetting, SchoolProfile, AcademicYearSetting, SystemSettings, GradingSystemSettings } from '@/types/settings';

export const settingsService = {
  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    const response = await api.get('/settings/terms/');
    const data = response.data;
    return data.results;
  },

  createTermSetting: async (termSetting: Omit<TermSetting, 'id'>): Promise<TermSetting> => {
    const response = await api.post('/settings/terms/', termSetting);
    const newSetting = response.data;
    return newSetting;
  },

  updateTermSetting: async (id: number, termSetting: Partial<TermSetting>): Promise<TermSetting> => {
    const response = await api.patch(`/settings/terms/${id}/`, termSetting);
    const updatedSetting = response.data;
    return updatedSetting;
  },

  deleteTermSetting: async (id: number): Promise<void> => {
    await api.delete(`/settings/terms/${id}/`);
  },

  // School Profile
  getSchoolProfile: async (): Promise<SchoolProfile> => {
    const response = await api.get('/settings/school-profile/');
    const data = response.data;
    return data;
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    const response = await api.patch('/settings/school-profile/', profile);
    const data = response.data;
    return data;
  },

  // Academic Years
  getAcademicYears: async (): Promise<AcademicYearSetting[]> => {
    const response = await api.get('/settings/academic-years/');
    const data = response.data;
    return data.results;
  },

  getCurrentAcademicYear: async (): Promise<AcademicYearSetting | null> => {
    const response = await api.get('/settings/academic-years/current/');
    const data = response.data;
    return data;
  },

  setCurrentAcademicYear: async (yearId: number): Promise<void> => {
    await api.post(`/settings/academic-years/${yearId}/set-current/`, {});
  },

  // System Settings
  getSystemSettings: async (): Promise<SystemSettings> => {
    const response = await api.get('/settings/system/');
    const data = response.data;
    return data;
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const response = await api.patch('/settings/system/', settings);
    const data = response.data;
    return data;
  },

  // Grading System Settings
  getGradingSettings: async (): Promise<GradingSystemSettings> => {
    const response = await api.get('/settings/grading/');
    const data = response.data;
    return data;
  },

  updateGradingSettings: async (settings: Partial<GradingSystemSettings>): Promise<GradingSystemSettings> => {
    const response = await api.patch('/settings/grading/', settings);
    const data = response.data;
    return data;
  },

  // Utility functions
  getCurrentTerm: async (): Promise<{ term: number; year: number } | null> => {
    const response = await api.get('/settings/current-term/');
    const data = response.data;
    return data;
  },
};