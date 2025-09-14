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
  // Classes - Using the correct authenticated endpoints
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const response = await api.get("/students/api/classes/", {
      params: filters,
    });
    return response.data;
  },

  async getClass(id: number): Promise<Class | null> {
    const response = await api.get(`/students/api/classes/${id}/`);
    return response.data;
  },

  async createClass(
    data: Omit<
      Class,
      "id" | "created_at" | "total_streams" | "total_students" | "capacity"
    >
  ): Promise<Class> {
    const response = await api.post("/students/api/classes/", data);
    return response.data;
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class | null> {
    const response = await api.patch(`/students/api/classes/${id}/`, data);
    return response.data;
  },

  async deleteClass(id: number): Promise<boolean> {
    await api.delete(`/students/api/classes/${id}/`);
    return true;
  },

  // Streams - Using the correct authenticated endpoints
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const response = await api.get("/students/api/streams/", {
      params: filters,
    });
    return response.data;
  },

  async getStream(id: number): Promise<Stream | null> {
    const response = await api.get(`/students/api/streams/${id}/`);
    return response.data;
  },

  async createStream(
    data: Omit<Stream, "id" | "created_at" | "current_enrollment">
  ): Promise<Stream> {
    const response = await api.post("/students/api/streams/", data);
    return response.data;
  },

  async updateStream(
    id: number,
    data: Partial<Stream>
  ): Promise<Stream | null> {
    const response = await api.patch(`/students/api/streams/${id}/`, data);
    return response.data;
  },

  async deleteStream(id: number): Promise<boolean> {
    await api.delete(`/students/api/streams/${id}/`);
    return true;
  },

  // Class Allocations
  async getClassAllocations(
    classId?: number,
    streamId?: number
  ): Promise<ClassAllocation[]> {
    const response = await api.get("/class-allocations/", {
      params: {
        class_id: classId,
        stream_id: streamId,
      },
    });
    return response.data.results || response.data;
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
      params: { stream_id: streamId },
    });
    return response.data;
  },

  // Statistics (dashboard) - Using temporary endpoint
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
