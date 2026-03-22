import { supabase } from "@/integrations/supabase/client";
import { SchoolProfile, TermSetting, AcademicYearSetting, SystemSettings, GradingSystemSettings } from "@/types/settings";
import { classService } from "@/services/classService";
import { streamSettingsService } from "@/services/streamSettingsService";
import {
  getLegacySchoolTypeFromManagedClassGroups,
  hasManagedClassGroupConfiguration,
  normalizeManagedClassGroups,
} from "@/utils/schoolClassGroups";

export interface SchoolSetupStatus {
  profileReady: boolean;
  termsReady: boolean;
  classesReady: boolean;
  streamsReady: boolean;
  complete: boolean;
}

const normalizeSchoolProfile = (profile: SchoolProfile): SchoolProfile => {
  const managedClassGroups = normalizeManagedClassGroups(profile.managed_class_groups, profile.type);

  return {
    ...profile,
    managed_class_groups: managedClassGroups,
    type: getLegacySchoolTypeFromManagedClassGroups(managedClassGroups, profile.type),
  };
};

const buildSchoolProfilePayload = (profile: Partial<SchoolProfile>) => {
  const managedClassGroups = normalizeManagedClassGroups(profile.managed_class_groups, profile.type);

  return {
    ...profile,
    managed_class_groups: managedClassGroups,
    type: getLegacySchoolTypeFromManagedClassGroups(managedClassGroups, profile.type),
  };
};

export const settingsService = {
  getSchoolProfile: async (): Promise<SchoolProfile | null> => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_school_profile');
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      return normalizeSchoolProfile(data[0] as SchoolProfile);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Error fetching school profile:', error);
      }
      throw error;
    }
  },

  createSchoolProfile: async (profile: Omit<SchoolProfile, "id" | "code" | "created_at" | "active">): Promise<SchoolProfile> => {
    try {
      const payload = buildSchoolProfilePayload(profile);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData?.user) {
        throw new Error('User not authenticated');
      }
      
      // Use RPC function to create school with elevated privileges
      const { data, error } = await supabase.rpc('create_school_profile', {
        p_name: payload.name,
        p_address: payload.address,
        p_phone: payload.phone,
        p_email: payload.email,
        p_type: payload.type || '',
        p_managed_class_groups: payload.managed_class_groups || [],
        p_motto: payload.motto || '',
        p_website: payload.website || '',
        p_logo: payload.logo || ''
      });

      if (error) {
        throw error;
      }
      
      // RPC returns an array, get the first item
      if (!data || data.length === 0) {
        throw new Error('School created but no data returned');
      }
      
      return normalizeSchoolProfile(data[0] as SchoolProfile);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to create school:', error);
      }
      throw error;
    }
  },

  updateSchoolProfile: async (profile: Partial<SchoolProfile>): Promise<SchoolProfile> => {
    const payload = buildSchoolProfilePayload(profile);
    const { data, error } = await supabase.rpc('update_school_profile', {
      p_name: payload.name,
      p_address: payload.address,
      p_phone: payload.phone,
      p_email: payload.email,
      p_type: payload.type || '',
      p_managed_class_groups: payload.managed_class_groups || [],
      p_motto: payload.motto || '',
      p_website: payload.website || '',
      p_logo: payload.logo || '',
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error('School profile was updated, but no data was returned');
    }

    return normalizeSchoolProfile(data[0] as SchoolProfile);
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

  getSchoolSetupStatus: async (): Promise<SchoolSetupStatus> => {
    const [profile, terms, classes, streamNames] = await Promise.all([
      settingsService.getSchoolProfile(),
      settingsService.getTermSettings(),
      classService.getClasses(),
      streamSettingsService.getStreamNames(),
    ]);

    const status: SchoolSetupStatus = {
      profileReady: Boolean(profile?.name && profile?.address && profile?.phone && profile?.email && hasManagedClassGroupConfiguration(profile)),
      termsReady: terms.length > 0,
      classesReady: classes.length > 0,
      streamsReady: streamNames.length > 0,
      complete: false,
    };

    status.complete = status.profileReady && status.termsReady && status.classesReady && status.streamsReady;
    return status;
  },
};
