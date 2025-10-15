// @ts-nocheck
import { api } from "@/api/api";
import { supabase } from "@/integrations/supabase/client";
import { TermSetting, SchoolProfile, AcademicYearSetting, SystemSettings, GradingSystemSettings } from '@/types/settings';

export const settingsService = {
  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    try {
      // Get term settings from Supabase
      const { data, error } = await supabase
        .from('settings_termsetting')
        .select('*')
        .order('year', { ascending: false })
        .order('term', { ascending: true });

      if (error) {
        console.error('Error fetching term settings:', error);
        throw new Error(`Failed to fetch term settings: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching term settings:', error);
      return []; // Return empty array instead of throwing to allow graceful handling
    }
  },

  createTermSetting: async (termSetting: Omit<TermSetting, 'id'>): Promise<TermSetting> => {
    try {
      // Get user's school ID
      const { data: profiles } = await supabase.rpc('get_current_user_profile');
      const userProfile = profiles?.[0] as { school_id: number } | undefined;

      if (!userProfile?.school_id) {
        throw new Error('No school associated with your account. Please create a school profile first.');
      }

      // Prepare insert data
      const insertData = {
        ...termSetting,
        school_id: userProfile.school_id
      };

      const { data, error } = await supabase
        .from('settings_termsetting')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating term setting:', error);
        if (error.message.includes('unique')) {
          throw new Error('A term setting for this year and term already exists');
        }
        throw new Error(`Failed to create term setting: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      console.error('Error creating term setting:', error);
      throw new Error(error.message || 'Failed to create term setting');
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
      const { error } = await supabase
        .from('settings_termsetting')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting term setting:', error);
        throw new Error(`Failed to delete term setting: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting term setting:', error);
      throw new Error(error.message || 'Failed to delete term setting');
    }
  },

  // School Profile
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      // Use the new helper function that safely gets school profile
      const { data, error } = await supabase.rpc('get_or_create_school_profile');

      if (error) {
        console.error('Error fetching school profile:', error);
        throw error;
      }
      
      // Return null if no school profile exists (user needs to create one)
      if (!data || data.length === 0) {
        return null;
      }

      const school = data[0];
      return {
        id: school.id,
        name: school.name,
        code: school.code,
        address: school.address,
        phone: school.phone,
        email: school.email,
        logo: school.logo || '',
        active: school.active,
        created_at: school.created_at,
        type: school.type || '',
        motto: school.motto || '',
        website: school.website || ''
      };
    } catch (error) {
      console.error('Error fetching school profile:', error);
      return null; // Return null instead of throwing to allow graceful handling
    }
  },

  createSchoolProfile: async (profile: { name: string; address: string; phone: string; email: string; type?: string; motto?: string; website?: string; logo?: string }): Promise<SchoolProfile> => {
    try {
      // Validate required fields
      if (!profile.name?.trim() || !profile.address?.trim() || !profile.phone?.trim() || !profile.email?.trim()) {
        throw new Error('Name, address, phone, and email are required fields');
      }

      // Clear any orphaned school references first
      try {
        await supabase.rpc('clear_orphaned_school_reference');
      } catch (cleanupError) {
        console.warn('Failed to clear orphaned school reference:', cleanupError);
        // Continue anyway - the RLS policy will catch real duplicates
      }

      // Generate a unique school code
      const timestamp = Date.now().toString().slice(-6);
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const schoolCode = `SCH${timestamp}${randomStr}`;

      const insertData: any = {
        name: profile.name.trim(),
        address: profile.address.trim(),
        phone: profile.phone.trim(),
        email: profile.email.trim(),
        code: schoolCode,
        active: true
      };

      // Add optional fields if provided and not empty
      if (profile.type?.trim()) insertData.type = profile.type.trim();
      if (profile.motto?.trim()) insertData.motto = profile.motto.trim();
      if (profile.website?.trim()) insertData.website = profile.website.trim();
      if (profile.logo?.trim()) insertData.logo = profile.logo.trim();

      console.log('Creating school with data:', { ...insertData, code: schoolCode });

      const { data, error } = await supabase
        .from('schools_school')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error creating school:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('row-level security') || error.message.includes('violates row-level security')) {
          throw new Error('You already have a school profile. Please refresh the page and try updating it instead.');
        }
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          throw new Error('A school with this information already exists. Please use different details.');
        }
        throw new Error(`Failed to create school: ${error.message}`);
      }

      if (!data) {
        throw new Error('School created but no data returned. Please refresh the page.');
      }

      console.log('School created successfully:', data);

      return {
        id: data.id,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo || '',
        active: data.active,
        created_at: data.created_at,
        type: data.type || '',
        motto: data.motto || '',
        website: data.website || ''
      };
    } catch (error: any) {
      console.error('Error creating school profile:', error);
      throw new Error(error.message || 'Failed to create school profile');
    }
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    try {
      // Get user's school ID
      const { data: profiles, error: profileError } = await supabase.rpc('get_current_user_profile');
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw new Error('Unable to fetch your profile. Please try again.');
      }

      const userProfile = profiles?.[0] as { school_id: number } | undefined;
      
      if (!userProfile?.school_id) {
        throw new Error('No school associated with your account. Please create a school profile first.');
      }

      // Prepare update data - only include fields that are provided
      const updateData: any = {};
      
      // Required fields - trim and validate
      if (profile.name !== undefined) {
        const trimmedName = profile.name.trim();
        if (trimmedName === '') {
          throw new Error('School name cannot be empty');
        }
        updateData.name = trimmedName;
      }
      
      if (profile.address !== undefined) {
        const trimmedAddress = profile.address.trim();
        if (trimmedAddress === '') {
          throw new Error('Address cannot be empty');
        }
        updateData.address = trimmedAddress;
      }
      
      if (profile.phone !== undefined) {
        const trimmedPhone = profile.phone.trim();
        if (trimmedPhone === '') {
          throw new Error('Phone cannot be empty');
        }
        updateData.phone = trimmedPhone;
      }
      
      if (profile.email !== undefined) {
        const trimmedEmail = profile.email.trim();
        if (trimmedEmail === '') {
          throw new Error('Email cannot be empty');
        }
        updateData.email = trimmedEmail;
      }

      // Optional fields - allow empty strings to clear values
      if (profile.type !== undefined) {
        updateData.type = profile.type?.trim() || null;
      }
      if (profile.motto !== undefined) {
        updateData.motto = profile.motto?.trim() || null;
      }
      if (profile.website !== undefined) {
        updateData.website = profile.website?.trim() || null;
      }
      if (profile.logo !== undefined) {
        updateData.logo = profile.logo?.trim() || null;
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields provided to update');
      }

      console.log('Updating school profile:', { school_id: userProfile.school_id, fields: Object.keys(updateData) });

      const { data, error } = await supabase
        .from('schools_school')
        .update(updateData)
        .eq('id', userProfile.school_id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating school:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('row-level security')) {
          throw new Error('You do not have permission to update this school profile.');
        }
        throw new Error(`Failed to update school profile: ${error.message}`);
      }

      if (!data) {
        throw new Error('Update succeeded but no data returned. Please refresh the page.');
      }

      console.log('School profile updated successfully');

      return {
        id: data.id,
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
        email: data.email,
        logo: data.logo || '',
        active: data.active,
        created_at: data.created_at,
        type: data.type || '',
        motto: data.motto || '',
        website: data.website || ''
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