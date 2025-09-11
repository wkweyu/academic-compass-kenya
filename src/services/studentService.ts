// Mock service - API integration pending
import { Student, StudentFilters, StudentStats, ImportResult } from "@/types/student";

// Mock data for development
const mockStudents: Student[] = [
  {
    id: '1',
    admission_number: '2024-0001',
    level: 'PP',
    full_name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    gender: 'M',
    date_of_birth: '2010-05-15',
    national_id: '12345678',
    photo: null,
    phone: '0712345678',
    email: 'john.doe@example.com',
    address: '123 Main Street, Nairobi',
    guardian_name: 'Jane Doe',
    guardian_phone: '0722345678',
    guardian_email: 'jane.doe@example.com',
    guardian_relationship: 'Mother',
    current_class: 1,
    current_stream: 1,
    current_class_name: 'Grade 4',
    current_stream_name: 'East',
    current_class_stream: 'Grade 4 East',
    admission_year: 2024,
    academic_year: 2024,
    term: 1,
    kcpe_index: '',
    is_on_transport: true,
    transport_type: 'two_way',
    status: 'active',
    is_active: true,
    enrollment_date: '2024-01-15',
    special_needs: '',
    notes: 'Excellent student with leadership qualities',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    admission_number: '2024-0002',
    level: 'PP',
    full_name: 'Mary Smith',
    first_name: 'Mary',
    last_name: 'Smith',
    gender: 'F',
    date_of_birth: '2011-03-22',
    national_id: '23456789',
    photo: null,
    phone: '0723456789',
    email: 'mary.smith@example.com',
    address: '456 Oak Avenue, Nairobi',
    guardian_name: 'Robert Smith',
    guardian_phone: '0733456789',
    guardian_email: 'robert.smith@example.com',
    guardian_relationship: 'Father',
    current_class: 1,
    current_stream: 2,
    current_class_name: 'Grade 3',
    current_stream_name: 'West',
    current_class_stream: 'Grade 3 West',
    admission_year: 2024,
    academic_year: 2024,
    term: 1,
    kcpe_index: '',
    is_on_transport: false,
    status: 'active',
    is_active: true,
    enrollment_date: '2024-01-20',
    special_needs: 'Requires reading glasses',
    notes: 'Very creative and artistic',
    created_at: '2024-01-20T09:00:00Z',
    updated_at: '2024-01-20T09:00:00Z',
  },
  {
    id: '3',
    admission_number: '2023-0156',
    level: 'JR',
    full_name: 'Peter Johnson',
    first_name: 'Peter',
    last_name: 'Johnson',
    gender: 'M',
    date_of_birth: '2008-11-10',
    national_id: '34567890',
    photo: null,
    phone: '0734567890',
    email: 'peter.johnson@example.com',
    address: '789 Pine Road, Nairobi',
    guardian_name: 'Susan Johnson',
    guardian_phone: '0744567890',
    guardian_email: 'susan.johnson@example.com',
    guardian_relationship: 'Mother',
    current_class: 2,
    current_stream: 1,
    current_class_name: 'Grade 7',
    current_stream_name: 'North',
    current_class_stream: 'Grade 7 North',
    admission_year: 2023,
    academic_year: 2024,
    term: 1,
    kcpe_index: 'KCP789012',
    is_on_transport: true,
    transport_type: 'one_way',
    status: 'active',
    is_active: true,
    enrollment_date: '2023-01-10',
    special_needs: '',
    notes: 'Strong in mathematics and sciences',
    created_at: '2023-01-10T08:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
  },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getStudents = async (
  params: StudentFilters = {}
): Promise<{ data: Student[]; total: number; page: number; limit: number }> => {
  await delay(500); // Simulate API delay
  
  let filteredStudents = [...mockStudents];
  
  // Apply filters
  if (params.search) {
    const searchTerm = params.search.toLowerCase();
    filteredStudents = filteredStudents.filter(student =>
      student.full_name.toLowerCase().includes(searchTerm) ||
      student.admission_number.toLowerCase().includes(searchTerm) ||
      student.guardian_name.toLowerCase().includes(searchTerm)
    );
  }
  
  if (params.admission_number) {
    filteredStudents = filteredStudents.filter(student =>
      student.admission_number.toLowerCase().includes(params.admission_number!.toLowerCase())
    );
  }
  
  if (params.class && params.class !== 'all') {
    filteredStudents = filteredStudents.filter(student =>
      student.current_class_name === params.class
    );
  }
  
  if (params.stream && params.stream !== 'all') {
    filteredStudents = filteredStudents.filter(student =>
      student.current_stream_name === params.stream
    );
  }
  
  if (params.status && params.status !== 'all') {
    filteredStudents = filteredStudents.filter(student =>
      student.status === params.status
    );
  }
  
  if (params.gender) {
    filteredStudents = filteredStudents.filter(student =>
      student.gender === params.gender
    );
  }
  
  if (params.academic_year) {
    filteredStudents = filteredStudents.filter(student =>
      student.academic_year === params.academic_year
    );
  }
  
  if (params.transport !== undefined) {
    filteredStudents = filteredStudents.filter(student =>
      student.is_on_transport === params.transport
    );
  }
  
  return {
    data: filteredStudents,
    total: filteredStudents.length,
    page: 1,
    limit: 50
  };
};

export const getStudentById = async (id: string): Promise<Student | null> => {
  await delay(300);
  const student = mockStudents.find(s => s.id === id);
  return student || null;
};

export const createStudent = async (
  studentData: Omit<Student, "id" | "admission_number" | "created_at" | "updated_at">
): Promise<Student> => {
  await delay(800);
  
  const newStudent: Student = {
    ...studentData,
    id: (mockStudents.length + 1).toString(),
    admission_number: `2024-${String(mockStudents.length + 1).padStart(4, '0')}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  mockStudents.push(newStudent);
  return newStudent;
};

export const updateStudent = async (id: string, studentData: Partial<Student>): Promise<Student | null> => {
  await delay(600);
  
  const index = mockStudents.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  const updatedStudent = {
    ...mockStudents[index],
    ...studentData,
    updated_at: new Date().toISOString(),
  };
  
  mockStudents[index] = updatedStudent;
  return updatedStudent;
};

export const deleteStudent = async (id: string): Promise<boolean> => {
  await delay(400);
  
  const index = mockStudents.findIndex(s => s.id === id);
  if (index === -1) return false;
  
  mockStudents.splice(index, 1);
  return true;
};

export const getStudentStats = async (): Promise<StudentStats> => {
  await delay(300);
  
  const total = mockStudents.length;
  const active = mockStudents.filter(s => s.status === 'active').length;
  const male = mockStudents.filter(s => s.gender === 'M').length;
  const female = mockStudents.filter(s => s.gender === 'F').length;
  
  const byClass: { [key: string]: number } = {};
  const byStatus: { [key: string]: number } = {};
  
  mockStudents.forEach(student => {
    byClass[student.current_class_name] = (byClass[student.current_class_name] || 0) + 1;
    byStatus[student.status] = (byStatus[student.status] || 0) + 1;
  });
  
  const enrollmentTrend = [
    { year: 2022, count: 145 },
    { year: 2023, count: 162 },
    { year: 2024, count: total },
  ];
  
  return {
    total_students: total,
    active_students: active,
    male_students: male,
    female_students: female,
    students_by_class: byClass,
    students_by_status: byStatus,
    enrollment_trend: enrollmentTrend,
  };
};

export const bulkImportStudents = async (file: File): Promise<ImportResult> => {
  await delay(2000); // Simulate longer processing time
  
  // Mock import result
  return {
    success: 25,
    errors: 2,
    warnings: 1,
    details: [
      { row: 15, message: 'Invalid phone number format', type: 'error' },
      { row: 23, message: 'Missing guardian email', type: 'warning' },
      { row: 27, message: 'Duplicate admission number', type: 'error' },
    ],
  };
};

export const exportStudents = async (filters: StudentFilters = {}): Promise<Blob> => {
  await delay(1000);
  
  const students = await getStudents(filters);
  
  // Create CSV content
  const headers = [
    'Admission Number',
    'Full Name',
    'Gender',
    'Date of Birth',
    'Class',
    'Stream',
    'Guardian Name',
    'Guardian Phone',
    'Status',
  ];
  
  const csvContent = [
    headers.join(','),
    ...students.data.map(student => [
      student.admission_number,
      student.full_name,
      student.gender,
      student.date_of_birth,
      student.current_class_name,
      student.current_stream_name,
      student.guardian_name,
      student.guardian_phone,
      student.status,
    ].join(','))
  ].join('\n');
  
  return new Blob([csvContent], { type: 'text/csv' });
};

export const getImportTemplate = (): Blob => {
  const headers = [
    'full_name',
    'gender',
    'date_of_birth',
    'guardian_name',
    'guardian_phone',
    'guardian_email',
    'current_class_name',
    'current_stream_name',
    'national_id',
    'phone',
    'email',
    'address',
  ];
  
  const sampleData = [
    'John Doe',
    'M',
    '2010-05-15',
    'Jane Doe',
    '0712345678',
    'jane@example.com',
    'Grade 4',
    'East',
    '12345678',
    '0723456789',
    'john@example.com',
    '123 Main St, Nairobi',
  ];
  
  const csvContent = [
    headers.join(','),
    sampleData.join(',')
  ].join('\n');
  
  return new Blob([csvContent], { type: 'text/csv' });
};
