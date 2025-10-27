import { supabase } from "@/integrations/supabase/client";
import { SchoolProfile, TermSetting, AcademicYearSetting, SystemSettings, GradingSystemSettings } from "@/types/settings";

export const settingsService = {
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      console.log('Fetching school profile...');
      const { data, error } = await supabase.rpc('get_or_create_school_profile');
      
      if (error) {
        console.error('RPC error:', error);
        throw error;
      }
      
      console.log('School profile data:', data);
      if (!data || data.length === 0) {
        console.log('No school profile found');
        return null;
      }
      
      return data[0] as SchoolProfile;
    } catch (error: any) {
      console.error('Error fetching school profile:', error);
      throw error;
    }
  },

  createSchoolProfile: async (profile: Omit<SchoolProfile, "id" | "code" | "created_at" | "active">): Promise<SchoolProfile> => {
    try {
      console.log('Creating school profile via RPC:', profile);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('Current user:', userData?.user?.id);
      
      if (userError || !userData?.user) {
        throw new Error('User not authenticated');
      }
      
      // Use RPC function to create school with elevated privileges
      const { data, error } = await supabase.rpc('create_school_profile', {
        p_name: profile.name,
        p_address: profile.address,
        p_phone: profile.phone,
        p_email: profile.email,
        p_type: profile.type || '',
        p_motto: profile.motto || '',
        p_website: profile.website || '',
        p_logo: profile.logo || ''
      });

      if (error) {
        console.error('Create school RPC error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('School created successfully via RPC:', data);
      
      // RPC returns an array, get the first item
      if (!data || data.length === 0) {
        throw new Error('School created but no data returned');
      }
      
      return data[0] as SchoolProfile;
    } catch (error) {
      console.error('Failed to create school:', error);
      throw error;
    }
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    const { data: currentProfile } = await supabase.rpc('get_or_create_school_profile');
    if (!currentProfile || currentProfile.length === 0) {
      throw new Error('No school profile found to update');
    }

    const schoolId = currentProfile[0].id;
    const { data, error } = await supabase
      .from('schools_school')
      .update(profile)
      .eq('id', schoolId)
      .select()
      .single();

    if (error) throw error;
    return data as SchoolProfile;
  },

  deleteSchoolProfile: async (schoolId: number): Promise<void> => {
    const { error } = await supabase
      .from('schools_school')
      .delete()
      .eq('id', schoolId);

    if (error) throw error;
  },

  // Term Settings
  getTermSettings: async (): Promise<TermSetting[]> => {
    const { data, error } = await supabase
      .from('settings_termsetting')
      .select('*')
      .order('year', { ascending: false })
      .order('term', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  createTermSetting: async (term: Omit<TermSetting, "id" | "school">): Promise<TermSetting> => {
    // Get the user's school_id
    const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
    if (schoolError || !schoolId) {
      throw new Error('Unable to determine user school');
    }

    const { data, error } = await supabase
      .from('settings_termsetting')
      .insert({
        school_id: schoolId,
        year: term.year,
        term: term.term,
        start_date: term.start_date,
        end_date: term.end_date,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateTermSetting: async (id: number, term: Partial<TermSetting>): Promise<TermSetting> => {
    const { data, error } = await supabase
      .from('settings_termsetting')
      .update({
        year: term.year,
        term: term.term,
        start_date: term.start_date,
        end_date: term.end_date,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteTermSetting: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('settings_termsetting')
      .delete()
      .eq('id', id);

    if (error) throw error;
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