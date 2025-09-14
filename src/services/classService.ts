import { api } from "@/api/api";
import {
  Class,
  Stream,
  ClassAllocation,
  ClassFilters,
  StreamFilters,
  ClassStats,
  BulkPromotionRequest,
  ClassTransferRequest,
} from "@/types/class";
import { Student } from "@/types/student";

export const classService = {
  // Classes
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const response = await api.get("/classes/", filters);
    return response.data.results;
  },

  async getClass(id: number): Promise<Class | null> {
    const response = await api.get(`/classes/${id}/`);
    return response.data;
  },

  async createClass(
    data: Omit<
      Class,
      "id" | "created_at" | "total_streams" | "total_students" | "capacity"
    >
  ): Promise<Class> {
    const response = await api.post("/classes/", data);
    return response.data;
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class | null> {
    const response = await api.patch(`/classes/${id}/`, data);
    return response.data;
  },

  async deleteClass(id: number): Promise<boolean> {
    await api.delete(`/classes/${id}/`);
    return true;
  },

  // Streams
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const response = await api.get("/streams/", filters);
    return response.data.results;
  },

  async getStream(id: number): Promise<Stream | null> {
    const response = await api.get(`/streams/${id}/`);
    return response.data;
  },

  async createStream(
    data: Omit<Stream, "id" | "created_at" | "current_enrollment">
  ): Promise<Stream> {
    const response = await api.post("/streams/", data);
    return response.data;
  },

  async updateStream(
    id: number,
    data: Partial<Stream>
  ): Promise<Stream | null> {
    const response = await api.patch(`/streams/${id}/`, data);
    return response.data;
  },

  async deleteStream(id: number): Promise<boolean> {
    await api.delete(`/streams/${id}/`);
    return true;
  },

  // Class Allocations
  async getClassAllocations(
    classId?: number,
    streamId?: number
  ): Promise<ClassAllocation[]> {
    const response = await api.get("/class-allocations/", {
      class_id: classId,
      stream_id: streamId,
    });
    return response.data.results;
  },

  async assignStudentToClass(
    studentId: string,
    classId: number,
    streamId: number,
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    const response = await api.post("/class-allocations/", {
      student_id: studentId,
      class_id: classId,
      stream_id: streamId,
      academic_year: academicYear,
      term: term,
    });
    return response.data;
  },

  // Class Students
  async getClassStudents(
    classId: number,
    streamId?: number
  ): Promise<Student[]> {
    const response = await api.get(`/classes/${classId}/students/`, {
      stream_id: streamId,
    });
    return response.data;
  },

  // Statistics (dashboard)
  async getClassStats(): Promise<ClassStats> {
    const response = await api.get("/dashboard/");
    return response.data;
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
