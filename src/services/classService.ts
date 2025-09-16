// @ts-nocheck
import { api } from "@/api/api";
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
  // Classes - Using the correct API endpoints
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    try {
      const response = await api.get("/api/students/classes/", { params: filters });
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      throw error;
    }
  },

  async getClass(id: number): Promise<Class | null> {
    try {
      const response = await api.get(`/api/students/classes/${id}/`);
      return response.data;
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
      const response = await api.post("/api/students/classes/", data);
      return response.data;
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class | null> {
    try {
      const response = await api.patch(`/api/students/classes/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating class:', error);
      return null;
    }
  },

  async deleteClass(id: number): Promise<boolean> {
    try {
      await api.delete(`/api/students/classes/${id}/`);
      return true;
    } catch (error) {
      console.error('Error deleting class:', error);
      return false;
    }
  },

  // Streams - Using the correct API endpoints
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    try {
      const response = await api.get("/api/students/streams/", filters);
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching streams:', error);
      return [];
    }
  },

  async getStream(id: number): Promise<Stream | null> {
    try {
      const response = await api.get(`/api/students/streams/${id}/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stream:', error);
      return null;
    }
  },

  async createStream(
    data: Omit<Stream, "id" | "created_at" | "current_enrollment">
  ): Promise<Stream> {
    try {
      const response = await api.post("/api/students/streams/", data);
      return response.data;
    } catch (error) {
      console.error('Error creating stream:', error);
      throw error;
    }
  },

  async updateStream(
    id: number,
    data: Partial<Stream>
  ): Promise<Stream | null> {
    try {
      const response = await api.patch(`/api/students/streams/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating stream:', error);
      return null;
    }
  },

  async deleteStream(id: number): Promise<boolean> {
    try {
      await api.delete(`/api/students/streams/${id}/`);
      return true;
    } catch (error) {
      console.error('Error deleting stream:', error);
      return false;
    }
  },

  // Class Allocations
  async getClassAllocations(
    classId?: number,
    streamId?: number
  ): Promise<ClassAllocation[]> {
    try {
      const response = await api.get("/class-allocations/", {
        class_id: classId,
        stream_id: streamId,
      });
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching class allocations:', error);
      return [];
    }
  },

  async assignStudentToClass(
    studentId: string,
    classId: number,
    streamId: number,
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    try {
      const response = await api.post("/class-allocations/", {
        student_id: studentId,
        class_id: classId,
        stream_id: streamId,
        academic_year: academicYear,
        term: term,
      });
      return response.data;
    } catch (error) {
      console.error('Error assigning student to class:', error);
      throw error;
    }
  },

  // Class Students
  async getClassStudents(
    classId: number,
    streamId?: number
  ): Promise<Student[]> {
    try {
      const response = await api.get(`/classes/${classId}/students/`, { stream_id: streamId });
      const data = response.data as any;
      return Array.isArray(data) ? data : (data?.results || data?.data || []);
    } catch (error) {
      console.error('Error fetching class students:', error);
      return [];
    }
  },

  // Statistics (dashboard) - Using temporary endpoint
  async getClassStats(): Promise<ClassStats> {
    try {
      const response = await api.get("/dashboard/");
      const stats = response.data?.stats || response.data || {};
      return {
        total_classes: stats.total_classes || 0,
        total_streams: stats.total_streams || 0,
        total_students_enrolled: stats.total_students_enrolled || 0,
        average_class_size: stats.average_class_size || 0,
        capacity_utilization: stats.capacity_utilization || 0,
        classes_by_grade: stats.classes_by_grade || {},
        enrollment_by_year: stats.enrollment_by_year || [],
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
