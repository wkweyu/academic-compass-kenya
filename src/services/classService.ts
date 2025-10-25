import { supabase } from "@/integrations/supabase/client";
import { Class, Stream, ClassFilters, StreamFilters, ClassStats } from "@/types/class";

export const classService = {
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const { data: userData } = await supabase.rpc('get_user_school_id');
    
    let query = supabase
      .from('students_class')
      .select('*');
    
    if (userData) {
      query = query.eq('school_id', userData);
    }
    
    const { data, error } = await query.order('grade', { ascending: true });
    
    if (error) throw error;
    return (data || []) as Class[];
  },

  async getClass(id: string): Promise<Class | null> {
    const { data, error } = await supabase
      .from('students_class')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as Class;
  },

  async createClass(data: Omit<Class, "id" | "created_at" | "total_streams" | "total_students" | "capacity" | "school">): Promise<Class> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    const { data: newClass, error } = await supabase
      .from('students_class')
      .insert({
        ...data,
        school_id: schoolId
      })
      .select()
      .single();
    
    if (error) throw error;
    return newClass as Class;
  },

  async updateClass(id: string, data: Partial<Class>): Promise<Class | null> {
    const { data: updated, error } = await supabase
      .from('students_class')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as Class;
  },

  async deleteClass(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('students_class')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const { data: userData } = await supabase.rpc('get_user_school_id');
    
    let query = supabase
      .from('students_stream')
      .select('*, students_class(name)');
    
    if (userData) {
      query = query.eq('school_id', userData);
    }
    
    if (filters?.class_id) {
      query = query.eq('class_id', filters.class_id);
    }
    
    const { data, error } = await query.order('name', { ascending: true });
    
    if (error) throw error;
    
    return (data || []).map(stream => ({
      ...stream,
      class_name: stream.students_class?.name || ''
    })) as Stream[];
  },

  async getStream(id: string): Promise<Stream | null> {
    const { data, error } = await supabase
      .from('students_stream')
      .select('*, students_class(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      class_name: data.students_class?.name || ''
    } as Stream;
  },

  async createStream(data: Omit<Stream, "id" | "created_at" | "current_enrollment" | "school" | "class_name">): Promise<Stream> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    const { data: newStream, error } = await supabase
      .from('students_stream')
      .insert({
        ...data,
        school_id: schoolId
      })
      .select('*, students_class(name)')
      .single();
    
    if (error) throw error;
    
    return {
      ...newStream,
      class_name: newStream.students_class?.name || ''
    } as Stream;
  },

  async updateStream(id: string, data: Partial<Stream>): Promise<Stream | null> {
    const { data: updated, error } = await supabase
      .from('students_stream')
      .update(data)
      .eq('id', id)
      .select('*, students_class(name)')
      .single();
    
    if (error) throw error;
    
    return {
      ...updated,
      class_name: updated.students_class?.name || ''
    } as Stream;
  },

  async deleteStream(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('students_stream')
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