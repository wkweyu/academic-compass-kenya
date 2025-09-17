import { supabase } from "@/integrations/supabase/client";
import {
  Class,
  Stream,
  ClassAllocation,
  ClassSubjectAllocation,
  ClassFilters,
  StreamFilters,
  ClassStats,
  BulkPromotionRequest,
  ClassTransferRequest,
} from "@/types/class";
import { Student } from "@/types/student";

export const classService = {
  // Classes - Using Supabase directly
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    try {
      let query = supabase
        .from('classes')
        .select('*');
      
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      
      if (filters?.grade_level) {
        query = query.eq('grade_level', filters.grade_level);
      }
      
      if (filters?.academic_year) {
        query = query.eq('academic_year', filters.academic_year.toString());
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      return data?.map((item: any) => ({
        id: item.id, // Keep as UUID string
        name: item.name,
        grade_level: item.grade_level,
        description: item.stream || '',
        school: 1, // Default school ID
        created_at: item.created_at,
        total_streams: 1,
        total_students: 0,
        capacity: item.capacity || 40
      })) || [];
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  async getClass(id: string): Promise<Class | null> {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      return data ? {
        id: data.id,
        name: data.name,
        grade_level: data.grade_level,
        description: data.stream || '',
        school: 1,
        created_at: data.created_at,
        total_streams: 1,
        total_students: 0,
        capacity: data.capacity || 40
      } : null;
    } catch (error) {
      console.error('Error fetching class:', error);
      throw error;
    }
  },

  async createClass(
    data: Omit<
      Class,
      "id" | "created_at" | "total_streams" | "total_students" | "capacity"
    >
  ): Promise<Class> {
    try {
      const { data: result, error } = await supabase
        .from('classes')
        .insert({
          name: data.name,
          grade_level: data.grade_level,
          stream: data.description || '',
          academic_year: new Date().getFullYear().toString(),
          capacity: 40
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: result.id,
        name: result.name,
        grade_level: result.grade_level,
        description: result.stream || '',
        school: 1,
        created_at: result.created_at,
        total_streams: 1,
        total_students: 0,
        capacity: result.capacity || 40
      };
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  },

  async updateClass(id: string, data: Partial<Class>): Promise<Class | null> {
    try {
      const { data: result, error } = await supabase
        .from('classes')
        .update({
          name: data.name,
          grade_level: data.grade_level,
          stream: data.description,
          capacity: data.capacity
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return result ? {
        id: result.id,
        name: result.name,
        grade_level: result.grade_level,
        description: result.stream || '',
        school: 1,
        created_at: result.created_at,
        total_streams: 1,
        total_students: 0,
        capacity: result.capacity || 40
      } : null;
    } catch (error) {
      console.error('Error updating class:', error);
      return null;
    }
  },

  async deleteClass(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting class:', error);
      return false;
    }
  },

  // Streams - Generated from classes data since streams are embedded in classes
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    try {
      let query = supabase
        .from('classes')
        .select('*');
      
      if (filters?.class_id) {
        query = query.eq('id', filters.class_id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Generate streams from classes data
      const streams = data?.map((classItem: any, index: number) => ({
        id: classItem.id,
        name: classItem.stream || 'Main',
        class_assigned: classItem.id,
        class_name: classItem.name,
        year: parseInt(classItem.academic_year) || new Date().getFullYear(),
        school: 1,
        capacity: classItem.capacity || 40,
        current_enrollment: 0,
        created_at: classItem.created_at,
        status: 'active' as const
      })) || [];
      
      return streams;
    } catch (error) {
      console.error('Error fetching streams:', error);
      return [];
    }
  },

  async getStream(id: string): Promise<Stream | null> {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      return data ? {
        id: data.id,
        name: data.stream || 'Main',
        class_assigned: data.id,
        class_name: data.name,
        year: parseInt(data.academic_year) || new Date().getFullYear(),
        school: 1,
        capacity: data.capacity || 40,
        current_enrollment: 0,
        created_at: data.created_at,
        status: 'active' as const
      } : null;
    } catch (error) {
      console.error('Error fetching stream:', error);
      return null;
    }
  },

  async createStream(
    data: Omit<Stream, "id" | "created_at" | "current_enrollment">
  ): Promise<Stream> {
    try {
      const { data: result, error } = await supabase
        .from('classes')
        .insert({
          name: data.class_assigned ? `Grade ${data.class_assigned}` : 'New Class',
          grade_level: data.class_assigned || 1,
          stream: data.name,
          academic_year: data.year.toString(),
          capacity: data.capacity
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: result.id,
        name: result.stream || 'Main',
        class_assigned: result.id,
        class_name: result.name,
        year: parseInt(result.academic_year),
        school: 1,
        capacity: result.capacity || 40,
        current_enrollment: 0,
        created_at: result.created_at,
        status: 'active' as const
      };
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  },

  async updateStream(
    id: string,
    data: Partial<Stream>
  ): Promise<Stream | null> {
    try {
      const { data: result, error } = await supabase
        .from('classes')
        .update({
          stream: data.name,
          capacity: data.capacity
        })
        .eq('id', id)
        .select()
        .maybeSingle();
      
      if (error) throw error;
      
      return result ? {
        id: result.id,
        name: result.stream || 'Main',
        class_assigned: result.id,
        class_name: result.name,
        year: parseInt(result.academic_year),
        school: 1,
        capacity: result.capacity || 40,
        current_enrollment: 0,
        created_at: result.created_at,
        status: 'active' as const
      } : null;
    } catch (error) {
      console.error('Error updating stream:', error);
      return null;
    }
  },

  async deleteStream(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting stream:', error);
      return false;
    }
  },

  // Class Allocations - Stub implementation
  async getClassAllocations(
    classId?: string,
    streamId?: string
  ): Promise<ClassAllocation[]> {
    console.log('getClassAllocations called with:', classId, streamId);
    return [];
  },

  async assignStudentToClass(
    studentId: string,
    classId: string,
    streamId: string,
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    console.log('assignStudentToClass called');
    return {
      id: 'stub',
      student_id: studentId,
      class_id: classId,
      stream_id: streamId,
      academic_year: academicYear,
      term,
      date_assigned: new Date().toISOString(),
      status: 'current'
    };
  },

  // Class Students - Stub implementation
  async getClassStudents(
    classId: string,
    streamId?: string
  ): Promise<Student[]> {
    console.log('getClassStudents called with:', classId, streamId);
    return [];
  },

  // Statistics - Stub implementation
  async getClassStats(): Promise<ClassStats> {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*');
      
      if (error) throw error;
      
      const classes = data || [];
      const gradeGroups = classes.reduce((acc: any, cls: any) => {
        acc[cls.grade_level] = (acc[cls.grade_level] || 0) + 1;
        return acc;
      }, {});

      return {
        total_classes: classes.length,
        total_streams: classes.length, // Each class has one stream in our model
        total_students_enrolled: 0, // TODO: Count from students table
        average_class_size: 0,
        capacity_utilization: 0,
        classes_by_grade: gradeGroups,
        enrollment_by_year: [],
      };
    } catch (error) {
      console.error('Error fetching class stats:', error);
      return {
        total_classes: 0,
        total_streams: 0,
        total_students_enrolled: 0,
        average_class_size: 0,
        capacity_utilization: 0,
        classes_by_grade: {},
        enrollment_by_year: [],
      };
    }
  },

  // Bulk Operations (stub)
  async promoteClass(
    request: BulkPromotionRequest
  ): Promise<{ success: number; errors: string[] }> {
    console.log(request);
    return { success: 0, errors: [] };
  },

  async transferStudent(request: ClassTransferRequest): Promise<boolean> {
    console.log(request);
    return false;
  },
};