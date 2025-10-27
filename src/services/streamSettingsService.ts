import { supabase } from "@/integrations/supabase/client";
import { StreamNameSetting } from "@/types/stream-settings";

export const streamSettingsService = {
  getStreamNames: async (): Promise<StreamNameSetting[]> => {
    const { data, error } = await supabase
      .from('stream_name_settings')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  createStreamName: async (streamName: Omit<StreamNameSetting, "id" | "created_at" | "updated_at">): Promise<StreamNameSetting> => {
    const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
    if (schoolError || !schoolId) {
      throw new Error('Unable to determine user school');
    }

    const { data, error } = await supabase
      .from('stream_name_settings')
      .insert({
        ...streamName,
        school_id: schoolId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateStreamName: async (id: number, streamName: Partial<StreamNameSetting>): Promise<StreamNameSetting> => {
    const { data, error } = await supabase
      .from('stream_name_settings')
      .update(streamName)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteStreamName: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('stream_name_settings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
