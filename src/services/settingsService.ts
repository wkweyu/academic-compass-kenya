// @ts-nocheck
import { api } from "@/api/api";
import { supabase } from "@/integrations/supabase/client";
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
      // Get user's school ID
      const { data: profiles } = await supabase.rpc('get_current_user_profile');
      const profile = profiles?.[0] as { school_id: number } | undefined;
      
      if (!profile?.school_id) {
        throw new Error('Unable to get user school information');
      }

      const updateData: any = {};
      if (termSetting.year !== undefined) updateData.year = termSetting.year;
      if (termSetting.term !== undefined) updateData.term = termSetting.term;
      if (termSetting.start_date !== undefined) updateData.start_date = termSetting.start_date;
      if (termSetting.end_date !== undefined) updateData.end_date = termSetting.end_date;

      const { data, error } = await supabase
        .from('settings_termsetting')
        .update(updateData)
        .eq('id', id)
        .eq('school_id', profile.school_id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        school: data.school_id,
        year: data.year,
        term: data.term,
        start_date: data.start_date,
        end_date: data.end_date
      };
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
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      // Get user's school ID first
      const { data: profiles } = await supabase.rpc('get_current_user_profile');
      const profile = profiles?.[0] as { school_id: number } | undefined;
      
      // Return null if user doesn't have a school yet (they need to create one)
      if (!profile?.school_id) {
        return null;
      }

      const { data, error } = await supabase
        .from('schools_school')
        .select('*')
        .eq('id', profile.school_id)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo,
        active: data.active,
        created_at: data.created_at
      };
    } catch (error) {
      console.error('Error fetching school profile:', error);
      throw error;
    }
  },

  createSchoolProfile: async (profile: { name: string; address: string; phone: string; email: string }): Promise<SchoolProfile> => {
    try {
      // Generate a unique school code
      const timestamp = Date.now().toString().slice(-6);
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const schoolCode = `SCH${timestamp}${randomStr}`;

      const { data, error } = await supabase
        .from('schools_school')
        .insert({
          name: profile.name.trim(),
          address: profile.address.trim(),
          phone: profile.phone.trim(),
          email: profile.email.trim(),
          code: schoolCode,
          active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw new Error(`Failed to create school: ${error.message}`);
      }

      return {
        id: data.id,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo,
        active: data.active,
        created_at: data.created_at
      };
    } catch (error: any) {
      console.error('Error creating school profile:', error);
      throw new Error(error.message || 'Failed to create school profile');
    }
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    try {
      // Get user's school ID first
      const { data: profiles, error: profileError } = await supabase.rpc('get_current_user_profile');
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw new Error('Unable to fetch user profile');
      }

      const userProfile = profiles?.[0] as { school_id: number } | undefined;
      
      if (!userProfile?.school_id) {
        throw new Error('No school associated with your account. Please contact support.');
      }

      // Prepare update data - only include fields that are provided and have values
      const updateData: any = {};
      
      // Only update fields that are provided and not empty (all fields are NOT NULL in DB)
      if (profile.name !== undefined && profile.name.trim() !== '') {
        updateData.name = profile.name.trim();
      }
      
      if (profile.address !== undefined && profile.address.trim() !== '') {
        updateData.address = profile.address.trim();
      }
      
      if (profile.phone !== undefined && profile.phone.trim() !== '') {
        updateData.phone = profile.phone.trim();
      }
      
      if (profile.email !== undefined && profile.email.trim() !== '') {
        updateData.email = profile.email.trim();
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      console.log('Updating school profile with data:', updateData);
      console.log('School ID:', userProfile.school_id);

      const { data, error } = await supabase
        .from('schools_school')
        .update(updateData)
        .eq('id', userProfile.school_id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Failed to update school profile: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from update');
      }

      return {
        id: data.id,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo,
        active: data.active,
        created_at: data.created_at
      };
    } catch (error: any) {
      console.error('Error updating school profile:', error);
      throw new Error(error.message || 'Failed to update school profile');
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