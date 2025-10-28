import { supabase } from "@/integrations/supabase/client";
import { Class, Stream, ClassFilters, StreamFilters, ClassStats } from "@/types/class";

export const classService = {
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    if (!schoolId) return [];

    // Get classes with basic info
    let query = supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('grade_level', { ascending: true });
    
    const { data: classesData, error } = await query;
    
    if (error) throw error;
    
    if (!classesData || classesData.length === 0) return [];

    // Fetch streams and students for all classes
    const [streamsResult, studentsResult] = await Promise.all([
      supabase
        .from('streams')
        .select('id, class_assigned_id, capacity')
        .eq('school_id', schoolId),
      supabase
        .from('students')
        .select('id, current_class_id')
        .eq('school_id', schoolId)
        .eq('is_active', true)
    ]);

    const streams = streamsResult.data || [];
    const students = studentsResult.data || [];

    // Calculate stats for each class
    return classesData.map(cls => {
      const classStreams = streams.filter(s => s.class_assigned_id === cls.id);
      const classStudents = students.filter(s => s.current_class_id === cls.id);
      const totalCapacity = classStreams.reduce((sum, s) => sum + (s.capacity || 0), 0);

      return {
        ...cls,
        total_streams: classStreams.length,
        total_students: classStudents.length,
        capacity: totalCapacity,
      } as Class;
    });
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
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    if (!schoolId) return [];

    let query = supabase
      .from('streams')
      .select('*, classes(name, grade_level)')
      .eq('school_id', schoolId);
    
    if (filters?.class_id) {
      query = query.eq('class_assigned_id', filters.class_id);
    }
    
    const { data: streamsData, error } = await query;
    
    if (error) throw error;
    
    if (!streamsData || streamsData.length === 0) return [];

    // Fetch students for enrollment counts
    const { data: students } = await supabase
      .from('students')
      .select('id, current_stream_id')
      .eq('school_id', schoolId)
      .eq('is_active', true);

    const studentsList = students || [];

    const streamsWithEnrollment = streamsData.map(stream => {
      // Use String comparison to handle potential type mismatches
      const enrolledStudents = studentsList.filter(s => 
        String(s.current_stream_id) === String(stream.id)
      );
      
      return {
        ...stream,
        class_assigned: stream.class_assigned_id,
        class_name: stream.classes?.name || '',
        current_enrollment: enrolledStudents.length,
        grade_level: stream.classes?.grade_level || 0
      } as Stream & { grade_level: number };
    });

    // Sort by grade level first, then by stream name
    return streamsWithEnrollment.sort((a, b) => {
      if (a.grade_level !== b.grade_level) {
        return a.grade_level - b.grade_level;
      }
      return a.name.localeCompare(b.name);
    });
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
    try {
      console.log('Fetching class stats...');
      
      const { data: schoolId, error: schoolError } = await supabase.rpc('get_user_school_id');
      
      console.log('School ID for class stats:', schoolId, 'Error:', schoolError);
      
      if (schoolError) {
        console.error('Error getting school ID:', schoolError);
        throw schoolError;
      }
      
      if (!schoolId) {
        console.warn('No school associated with user');
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

      // Fetch classes, streams, and students in parallel
      const [classesResult, streamsResult, studentsResult] = await Promise.all([
        supabase
          .from('classes')
          .select('id, grade_level')
          .eq('school_id', schoolId),
        supabase
          .from('streams')
          .select('id, capacity')
          .eq('school_id', schoolId),
        supabase
          .from('students')
          .select('id, current_class_id')
          .eq('school_id', schoolId)
          .eq('is_active', true)
      ]);

      console.log('Classes fetched:', classesResult.data?.length, 'Error:', classesResult.error);
      console.log('Streams fetched:', streamsResult.data?.length, 'Error:', streamsResult.error);
      console.log('Students fetched:', studentsResult.data?.length, 'Error:', studentsResult.error);

      if (classesResult.error) throw classesResult.error;
      if (streamsResult.error) throw streamsResult.error;
      if (studentsResult.error) throw studentsResult.error;

      const classes = classesResult.data || [];
      const streams = streamsResult.data || [];
      const students = studentsResult.data || [];

      const total_classes = classes.length;
      const total_streams = streams.length;
      const total_students_enrolled = students.length;
      
      // Calculate average class size
      const average_class_size = total_classes > 0 
        ? Math.round(total_students_enrolled / total_classes) 
        : 0;

      // Calculate capacity utilization
      const total_capacity = streams.reduce((sum, s) => sum + (s.capacity || 0), 0);
      const capacity_utilization = total_capacity > 0 
        ? Math.round((total_students_enrolled / total_capacity) * 100) 
        : 0;

      // Group classes by grade
      const classes_by_grade: Record<string, number> = {};
      classes.forEach(cls => {
        const grade = `Grade ${cls.grade_level}`;
        classes_by_grade[grade] = (classes_by_grade[grade] || 0) + 1;
      });

      console.log('Class stats calculated:', { 
        total_classes, 
        total_streams, 
        total_students_enrolled, 
        average_class_size, 
        capacity_utilization 
      });

      return {
        total_classes,
        total_streams,
        total_students_enrolled,
        average_class_size,
        capacity_utilization,
        classes_by_grade,
        enrollment_by_year: [],
      };
    } catch (error) {
      console.error('Error in getClassStats:', error);
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
};