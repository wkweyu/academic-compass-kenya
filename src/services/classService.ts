import client from '@/api/client';
import { 
  Class, 
  Stream, 
  ClassAllocation, 
  ClassSubjectAllocation,
  ClassFilters, 
  StreamFilters,
  ClassStats,
  BulkPromotionRequest,
  ClassTransferRequest 
} from '@/types/class';

export const classService = {
  // Classes
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.grade_level) params.append('grade_level', filters.grade_level.toString());
    
    return client<Class[]>(`students/classes/?${params.toString()}`);
  },

  async getClass(id: number): Promise<Class> {
    return client<Class>(`students/classes/${id}/`);
  },

  async createClass(data: Omit<Class, 'id' | 'created_at'>): Promise<Class> {
    return client<Class>('students/classes/', { data, method: 'POST' });
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class> {
    return client<Class>(`students/classes/${id}/`, { data, method: 'PUT' });
  },

  async deleteClass(id: number): Promise<void> {
    return client<void>(`students/classes/${id}/`, { method: 'DELETE' });
  },

  // Streams
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.class_id) params.append('class_id', filters.class_id.toString());
    if (filters?.academic_year) params.append('academic_year', filters.academic_year.toString());
    
    return client<Stream[]>(`students/streams/?${params.toString()}`);
  },

  async getStream(id: number): Promise<Stream> {
    return client<Stream>(`students/streams/${id}/`);
  },

  async createStream(data: Omit<Stream, 'id' | 'created_at'>): Promise<Stream> {
    return client<Stream>('students/streams/', { data, method: 'POST' });
  },

  async updateStream(id: number, data: Partial<Stream>): Promise<Stream> {
    return client<Stream>(`students/streams/${id}/`, { data, method: 'PUT' });
  },

  async deleteStream(id: number): Promise<void> {
    return client<void>(`students/streams/${id}/`, { method: 'DELETE' });
  },

  // The rest of the functions are not implemented yet on the backend.
  // I will leave them as they are for now.
  async getClassAllocations(classId?: number, streamId?: number): Promise<ClassAllocation[]> {
    return Promise.resolve([]);
  },

  async assignStudentToClass(
    studentId: string, 
    classId: number, 
    streamId: number, 
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    return Promise.reject(new Error("Not implemented"));
  },

  async promoteClass(request: BulkPromotionRequest): Promise<{ success: number; errors: string[] }> {
    return Promise.reject(new Error("Not implemented"));
  },

  async transferStudent(request: ClassTransferRequest): Promise<boolean> {
    return Promise.reject(new Error("Not implemented"));
  },

  async getClassStats(): Promise<ClassStats> {
    // This would need a dedicated endpoint on the backend
    return Promise.resolve({
      total_classes: 0,
      total_streams: 0,
      total_students_enrolled: 0,
      average_class_size: 0,
      capacity_utilization: 0,
      classes_by_grade: {},
      enrollment_by_year: []
    });
  },

  async getClassStudents(classId: number, streamId?: number): Promise<any[]> {
    return Promise.resolve([]);
  }
};