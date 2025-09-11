import apiFetch from "@/lib/api";
import { Student } from "@/types/cbc"; // I'll need to create this type file

// The Student type from the component might need to be moved to a central types file
// I'll assume this for now.

export const getStudents = (
  params: { search?: string; class?: string; status?: string } = {}
) => {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.class && params.class !== "all")
    query.append("current_class", params.class);
  if (params.status && params.status !== "all")
    query.append("status", params.status);

  return apiFetch(`/students/?${query.toString()}`);
};

export const getStudentById = (id: string) => {
  return apiFetch(`/students/${id}/`);
};

export const createStudent = (
  studentData: Omit<Student, "id" | "admission_number">
) => {
  // The API might expect multipart/form-data if there's a file upload.
  // For now, assuming JSON. This might need to be adjusted.
  return apiFetch("/students/", {
    method: "POST",
    body: JSON.stringify(studentData),
  });
};

export const updateStudent = (id: string, studentData: Partial<Student>) => {
  return apiFetch(`/students/${id}/`, {
    method: "PATCH", // PATCH is better for partial updates
    body: JSON.stringify(studentData),
  });
};

export const deleteStudent = (id: string) => {
  return apiFetch(`/students/${id}/`, {
    method: "DELETE",
  });
};
