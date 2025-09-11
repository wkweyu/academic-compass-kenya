<<<<<<< HEAD
import apiFetch from '@/lib/api';
import { Student } from '@/types/cbc'; // I'll need to create this type file

// The Student type from the component might need to be moved to a central types file
// I'll assume this for now.

export const getStudents = (params: { search?: string; class?: string; status?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.class && params.class !== 'all') query.append('current_class', params.class);
  if (params.status && params.status !== 'all') query.append('status', params.status);

  return apiFetch(`/students/?${query.toString()}`);
};

export const getStudentById = (id: string) => {
  return apiFetch(`/students/${id}/`);
};

export const createStudent = (studentData: Omit<Student, 'id' | 'admission_number'>) => {
  // The API might expect multipart/form-data if there's a file upload.
  // For now, assuming JSON. This might need to be adjusted.
  return apiFetch('/students/', {
    method: 'POST',
    body: JSON.stringify(studentData),
  });
};

export const updateStudent = (id: string, studentData: Partial<Student>) => {
  return apiFetch(`/students/${id}/`, {
    method: 'PATCH', // PATCH is better for partial updates
    body: JSON.stringify(studentData),
  });
};

export const deleteStudent = (id: string) => {
  return apiFetch(`/students/${id}/`, {
    method: 'DELETE',
  });
=======
import { Student } from '@/types/cbc';

// Mock data for demonstration
const mockStudents: Student[] = [
  {
    id: '1',
    admission_number: 'STU001',
    full_name: 'Alice Johnson',
    date_of_birth: '2014-05-15',
    gender: 'F',
    guardian_name: 'Mary Johnson',
    guardian_phone: '+254700123456',
    guardian_email: 'mary.johnson@email.com',
    current_class: 4,
    current_stream: 1,
    current_class_name: 'Grade 4',
    current_stream_name: 'East',
    enrollment_date: '2023-01-15',
    status: 'active',
    photo: null,
    is_active: true
  },
  {
    id: '2',
    admission_number: 'STU002',
    full_name: 'Brian Kiprop',
    date_of_birth: '2013-08-22',
    gender: 'M',
    guardian_name: 'James Kiprop',
    guardian_phone: '+254711234567',
    guardian_email: 'james.kiprop@email.com',
    current_class: 5,
    current_stream: 2,
    current_class_name: 'Grade 5',
    current_stream_name: 'West',
    enrollment_date: '2023-01-15',
    status: 'active',
    photo: null,
    is_active: true
  },
  {
    id: '3',
    admission_number: 'STU003',
    full_name: 'Catherine Wanjiku',
    date_of_birth: '2012-12-10',
    gender: 'F',
    guardian_name: 'Grace Wanjiku',
    guardian_phone: '+254722345678',
    guardian_email: 'grace.wanjiku@email.com',
    current_class: 6,
    current_stream: 1,
    current_class_name: 'Grade 6',
    current_stream_name: 'East',
    enrollment_date: '2023-01-15',
    status: 'active',
    photo: null,
    is_active: true
  }
];

let studentsData = [...mockStudents];

export const getStudents = async (params: { search?: string; class?: string; status?: string } = {}): Promise<Student[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let filtered = [...studentsData];
  
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter(student => 
      student.full_name.toLowerCase().includes(searchLower) ||
      student.admission_number.toLowerCase().includes(searchLower)
    );
  }
  
  if (params.class && params.class !== 'all') {
    filtered = filtered.filter(student => student.current_class_name === params.class);
  }
  
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter(student => student.status === params.status);
  }
  
  return filtered;
};

export const getStudentById = async (id: string): Promise<Student | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return studentsData.find(student => student.id === id) || null;
};

export const createStudent = async (studentData: Omit<Student, 'id' | 'admission_number'>): Promise<Student> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const newStudent: Student = {
    ...studentData,
    id: Math.random().toString(36).substr(2, 9),
    admission_number: `STU${String(studentsData.length + 1).padStart(3, '0')}`
  };
  
  studentsData.push(newStudent);
  return newStudent;
};

export const updateStudent = async (id: string, studentData: Partial<Student>): Promise<Student> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const index = studentsData.findIndex(student => student.id === id);
  if (index === -1) {
    throw new Error('Student not found');
  }
  
  studentsData[index] = { ...studentsData[index], ...studentData };
  return studentsData[index];
};

export const deleteStudent = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const index = studentsData.findIndex(student => student.id === id);
  if (index === -1) {
    throw new Error('Student not found');
  }
  
  studentsData.splice(index, 1);
>>>>>>> ac7828269a6664fd6413e1756f459d58d5f507b1
};
