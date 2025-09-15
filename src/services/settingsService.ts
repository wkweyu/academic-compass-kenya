// @ts-nocheck
import { api } from "@/api/api";
import { TermSetting, SchoolProfile, AcademicYearSetting, SystemSettings, GradingSystemSettings } from '@/types/settings';

export const settingsService = {
  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    try {
      const response = await api.get('/settings/terms/');
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching term settings:', error);
      return [];
    }
  },

  createTermSetting: async (termSetting: Omit<TermSetting, 'id'>): Promise<TermSetting> => {
    try {
      const response = await api.post('/settings/terms/', termSetting);
      return response.data;
    } catch (error) {
      console.error('Error creating term setting:', error);
      throw error;
    }
  },

  updateTermSetting: async (id: number, termSetting: Partial<TermSetting>): Promise<TermSetting> => {
    try {
      const response = await api.patch(`/settings/terms/${id}/`, termSetting);
      return response.data;
    } catch (error) {
      console.error('Error updating term setting:', error);
      throw error;
    }
  },

  deleteTermSetting: async (id: number): Promise<void> => {
    try {
      await api.delete(`/settings/terms/${id}/`);
    } catch (error) {
      console.error('Error deleting term setting:', error);
      throw error;
    }
  },

  // School Profile
  getSchoolProfile: async (): Promise<SchoolProfile> => {
    try {
      const response = await api.get('/settings/school-profile/');
      return response.data;
    } catch (error) {
      console.error('Error fetching school profile:', error);
      throw error;
    }
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    try {
      const response = await api.patch('/settings/school-profile/', profile);
      return response.data;
    } catch (error) {
      console.error('Error updating school profile:', error);
      throw error;
    }
  },

  // Academic Years
  getAcademicYears: async (): Promise<AcademicYearSetting[]> => {
    try {
      const response = await api.get('/settings/academic-years/');
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching academic years:', error);
      return [];
    }
  },

  getCurrentAcademicYear: async (): Promise<AcademicYearSetting | null> => {
    try {
      const response = await api.get('/settings/academic-years/current/');
      return response.data;
    } catch (error) {
      console.error('Error fetching current academic year:', error);
      return null;
    }
  },

  setCurrentAcademicYear: async (yearId: number): Promise<void> => {
    try {
      await api.post(`/settings/academic-years/${yearId}/set-current/`, {});
    } catch (error) {
      console.error('Error setting current academic year:', error);
      throw error;
    }
  },

  // System Settings
  getSystemSettings: async (): Promise<SystemSettings> => {
    try {
      const response = await api.get('/settings/system/');
      return response.data;
    } catch (error) {
      console.error('Error fetching system settings:', error);
      throw error;
    }
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    try {
      const response = await api.patch('/settings/system/', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating system settings:', error);
      throw error;
    }
  },

  // Grading System Settings
  getGradingSettings: async (): Promise<GradingSystemSettings> => {
    try {
      const response = await api.get('/settings/grading/');
      return response.data;
    } catch (error) {
      console.error('Error fetching grading settings:', error);
      throw error;
    }
  },

  updateGradingSettings: async (settings: Partial<GradingSystemSettings>): Promise<GradingSystemSettings> => {
    try {
      const response = await api.patch('/settings/grading/', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating grading settings:', error);
      throw error;
    }
  },

  // Utility functions
  getCurrentTerm: async (): Promise<{ term: number; year: number } | null> => {
    try {
      const response = await api.get('/settings/current-term/');
      return response.data;
    } catch (error) {
      console.error('Error fetching current term:', error);
      return null;
    }
  },
};