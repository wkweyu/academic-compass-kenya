import { api } from "@/api/api";
import { 
  Class, 
  Stream, 
  ClassAllocation, 
  ClassFilters, 
  StreamFilters,
  ClassStats,
  BulkPromotionRequest,
  ClassTransferRequest 
} from '@/types/class';
import { Student } from '@/types/student';

export const classService = {
  // Classes
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const response = await api.get('/classes/', filters);
    const data = response.data;
    return data.results;
  },

  async getClass(id: number): Promise<Class | null> {
    const response = await api.get(`/classes/${id}/`);
    const data = response.data;
    return data;
  },

  async createClass(data: Omit<Class, 'id' | 'created_at' | 'total_streams' | 'total_students' | 'capacity'>): Promise<Class> {
    const response = await api.post('/classes/', data);
    const newClass = response.data;
    return newClass;
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class | null> {
    const response = await api.patch(`/classes/${id}/`, data);
    const updatedClass = response.data;
    return updatedClass;
  },

  async deleteClass(id: number): Promise<boolean> {
    await api.delete(`/classes/${id}/`);
    return true;
  },

  // Streams
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const response = await api.get('/streams/', filters);
    const data = response.data;
    return data.results;
  },

  async getStream(id: number): Promise<Stream | null> {
    const response = await api.get(`/streams/${id}/`);
    const data = response.data;
    return data;
  },

  async createStream(data: Omit<Stream, 'id' | 'created_at' | 'current_enrollment'>): Promise<Stream> {
    const response = await api.post('/streams/', data);
    const newStream = response.data;
    return newStream;
  },

  async updateStream(id: number, data: Partial<Stream>): Promise<Stream | null> {
    const response = await api.patch(`/streams/${id}/`, data);
    const updatedStream = response.data;
    return updatedStream;
  },

  async deleteStream(id: number): Promise<boolean> {
    await api.delete(`/streams/${id}/`);
    return true;
  },

  // Class Allocations
  async getClassAllocations(classId?: number, streamId?: number): Promise<ClassAllocation[]> {
    const response = await api.get('/class-allocations/', { class_id: classId, stream_id: streamId });
    const data = response.data;
    return data.results;
  },

  async assignStudentToClass(
    studentId: string, 
    classId: number, 
    streamId: number, 
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    const response = await api.post('/class-allocations/', {
      student_id: studentId,
      class_id: classId,
      stream_id: streamId,
      academic_year: academicYear,
      term: term,
    });
    const allocation = response.data;
    return allocation;
  },

  // Bulk Operations
  async promoteClass(request: BulkPromotionRequest): Promise<{ success: number; errors: string[] }> {
    // TODO: Implement this function
    console.log(request);
    return { success: 0, errors: [] };
  },

  async transferStudent(request: ClassTransferRequest): Promise<boolean> {
    // TODO: Implement this function
    console.log(request);
    return false;
  },

  // Statistics
  async getClassStats(): Promise<ClassStats> {
    // TODO: Implement this function
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

  // Student list for class
  async getClassStudents(classId: number, streamId?: number): Promise<Student[]> {
    const response = await api.get(`/classes/${classId}/students/`, { stream_id: streamId });
    const data = response.data;
    return data;
  }
};