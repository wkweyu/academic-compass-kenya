import { supabase } from "@/integrations/supabase/client";
import { Class, Stream, ClassFilters, StreamFilters, ClassStats } from "@/types/class";

export const classService = {
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    let query = supabase
      .from('classes')
      .select('*');
    
    const { data, error } = await query.order('grade_level', { ascending: true });
    
    if (error) throw error;
    return (data || []) as Class[];
  },

  async getClass(id: string): Promise<Class | null> {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Class;
  },

  async createClass(data: Omit<Class, "id" | "created_at" | "total_streams" | "total_students" | "capacity" | "school">): Promise<Class> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    const { data: newClass, error } = await supabase
      .from('classes')
      .insert({
        name: data.name,
        grade_level: data.grade_level,
        description: data.description || '',
        school_id: schoolId
      })
      .select()
      .single();
    
    if (error) throw error;
    return newClass as Class;
  },

  async updateClass(id: string, data: Partial<Class>): Promise<Class | null> {
    const { data: updated, error } = await supabase
      .from('classes')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as Class;
  },

  async deleteClass(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    let query = supabase
      .from('streams')
      .select('*, classes(name)');
    
    if (filters?.class_id) {
      query = query.eq('class_assigned_id', filters.class_id);
    }
    
    const { data, error } = await query.order('name', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(stream => ({
      ...stream,
      class_assigned: stream.class_assigned_id, // Map database field to frontend field
      class_name: stream.classes?.name || ''
    })) as Stream[];
  },

  async getStream(id: string): Promise<Stream | null> {
    const { data, error } = await supabase
      .from('streams')
      .select('*, classes(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      class_assigned: data.class_assigned_id, // Map database field to frontend field
      class_name: data.classes?.name || ''
    } as Stream;
  },

  async createStream(data: Omit<Stream, "id" | "created_at" | "current_enrollment" | "school" | "class_name" | "class_assigned_id">): Promise<Stream> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    const { data: newStream, error } = await supabase
      .from('streams')
      .insert({
        name: data.name,
        class_assigned_id: data.class_assigned,
        year: data.year,
        capacity: data.capacity,
        school_id: schoolId
      })
      .select('*, classes(name)')
      .single();
    
    if (error) throw error;
    
    return {
      ...newStream,
      class_assigned: newStream.class_assigned_id, // Map database field to frontend field
      class_name: newStream.classes?.name || ''
    } as Stream;
  },

  async updateStream(id: string, data: Partial<Stream>): Promise<Stream | null> {
    const updateData: any = { ...data };
    // Map frontend field to database field if present
    if (data.class_assigned) {
      updateData.class_assigned_id = data.class_assigned;
      delete updateData.class_assigned;
    }
    
    const { data: updated, error } = await supabase
      .from('streams')
      .update(updateData)
      .eq('id', id)
      .select('*, classes(name)')
      .single();
    
    if (error) throw error;
    
    return {
      ...updated,
      class_assigned: updated.class_assigned_id, // Map database field to frontend field
      class_name: updated.classes?.name || ''
    } as Stream;
  },

  async deleteStream(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('streams')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async getClassStats(): Promise<ClassStats> {
    // This endpoint doesn't exist yet, so we'll return a stub
    return {
      total_classes: 0,
      total_streams: 0,
      total_students_enrolled: 0,
      average_class_size: 0,
      capacity_utilization: 0,
      classes_by_grade: {},
      enrollment_by_year: [],
    };
  },
};