import { api } from "@/api/api";
import { Class, Stream, ClassFilters, StreamFilters, ClassStats } from "@/types/class";

export const classService = {
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    const response = await api.get<Class[]>("/students/api/classes/", { params: filters });
    return response.data;
  },

  async getClass(id: string): Promise<Class | null> {
    const response = await api.get<Class>(`/students/api/classes/${id}/`);
    return response.data;
  },

  async createClass(data: Omit<Class, "id" | "created_at" | "total_streams" | "total_students" | "capacity" | "school">): Promise<Class> {
    const response = await api.post<Class>("/students/api/classes/", data);
    return response.data;
  },

  async updateClass(id: string, data: Partial<Class>): Promise<Class | null> {
    const response = await api.put<Class>(`/students/api/classes/${id}/`, data);
    return response.data;
  },

  async deleteClass(id: string): Promise<boolean> {
    await api.delete(`/students/api/classes/${id}/`);
    return true;
  },

  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    const response = await api.get<Stream[]>("/students/api/streams/", { params: filters });
    return response.data;
  },

  async getStream(id: string): Promise<Stream | null> {
    const response = await api.get<Stream>(`/students/api/streams/${id}/`);
    return response.data;
  },

  async createStream(data: Omit<Stream, "id" | "created_at" | "current_enrollment" | "school" | "class_name">): Promise<Stream> {
    const response = await api.post<Stream>("/students/api/streams/", data);
    return response.data;
  },

  async updateStream(id: string, data: Partial<Stream>): Promise<Stream | null> {
    const response = await api.put<Stream>(`/students/api/streams/${id}/`, data);
    return response.data;
  },

  async deleteStream(id: string): Promise<boolean> {
    await api.delete(`/students/api/streams/${id}/`);
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