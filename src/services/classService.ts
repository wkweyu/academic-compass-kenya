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
import { Student } from '@/types/student';

// Mock data for classes
const mockClasses: Class[] = [
  {
    id: 1,
    name: 'Grade 1',
    grade_level: 1,
    description: 'First grade primary class',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    total_streams: 3,
    total_students: 95,
    capacity: 120
  },
  {
    id: 2,
    name: 'Grade 2',
    grade_level: 2,
    description: 'Second grade primary class',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    total_streams: 2,
    total_students: 68,
    capacity: 80
  },
  {
    id: 3,
    name: 'Grade 3',
    grade_level: 3,
    description: 'Third grade primary class',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    total_streams: 2,
    total_students: 72,
    capacity: 80
  },
  {
    id: 4,
    name: 'Form 1',
    grade_level: 9,
    description: 'First form secondary class',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    total_streams: 4,
    total_students: 142,
    capacity: 160
  },
];

// Mock data for streams
const mockStreams: Stream[] = [
  {
    id: 1,
    name: 'A',
    class_assigned: 1,
    class_name: 'Grade 1',
    year: 2024,
    school: 1,
    capacity: 40,
    current_enrollment: 35,
    created_at: '2024-01-15T00:00:00Z',
    class_teacher: 1,
    class_teacher_name: 'Mrs. Sarah Johnson',
    status: 'active'
  },
  {
    id: 2,
    name: 'B',
    class_assigned: 1,
    class_name: 'Grade 1',
    year: 2024,
    school: 1,
    capacity: 40,
    current_enrollment: 32,
    created_at: '2024-01-15T00:00:00Z',
    class_teacher: 2,
    class_teacher_name: 'Mr. David Wilson',
    status: 'active'
  },
  {
    id: 3,
    name: 'C',
    class_assigned: 1,
    class_name: 'Grade 1',
    year: 2024,
    school: 1,
    capacity: 40,
    current_enrollment: 28,
    created_at: '2024-01-15T00:00:00Z',
    class_teacher: 3,
    class_teacher_name: 'Ms. Emily Davis',
    status: 'active'
  },
  {
    id: 4,
    name: 'A',
    class_assigned: 4,
    class_name: 'Form 1',
    year: 2024,
    school: 1,
    capacity: 40,
    current_enrollment: 38,
    created_at: '2024-01-15T00:00:00Z',
    class_teacher: 4,
    class_teacher_name: 'Mr. John Smith',
    status: 'active'
  },
];

// Mock allocations
const mockAllocations: ClassAllocation[] = [
  {
    id: '1',
    student_id: '1',
    student_name: 'John Doe',
    student_admission_no: 'ADM001',
    class_id: 1,
    stream_id: 1,
    academic_year: 2024,
    term: 1,
    date_assigned: '2024-01-15T00:00:00Z',
    status: 'current'
  },
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

export const classService = {
  // Classes
  async getClasses(filters?: ClassFilters): Promise<Class[]> {
    await apiDelay();
    let classes = [...mockClasses];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      classes = classes.filter(cls => 
        cls.name.toLowerCase().includes(search) ||
        cls.description?.toLowerCase().includes(search)
      );
    }
    
    if (filters?.grade_level) {
      classes = classes.filter(cls => cls.grade_level === filters.grade_level);
    }
    
    return classes;
  },

  async getClass(id: number): Promise<Class | null> {
    await apiDelay();
    return mockClasses.find(cls => cls.id === id) || null;
  },

  async createClass(data: Omit<Class, 'id' | 'created_at' | 'total_streams' | 'total_students' | 'capacity'>): Promise<Class> {
    await apiDelay();
    const newClass: Class = {
      ...data,
      id: Math.max(...mockClasses.map(c => c.id)) + 1,
      created_at: new Date().toISOString(),
      total_streams: 0,
      total_students: 0,
      capacity: 0
    };
    mockClasses.push(newClass);
    return newClass;
  },

  async updateClass(id: number, data: Partial<Class>): Promise<Class | null> {
    await apiDelay();
    const index = mockClasses.findIndex(cls => cls.id === id);
    if (index === -1) return null;
    
    mockClasses[index] = { ...mockClasses[index], ...data };
    return mockClasses[index];
  },

  async deleteClass(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockClasses.findIndex(cls => cls.id === id);
    if (index === -1) return false;
    
    mockClasses.splice(index, 1);
    return true;
  },

  // Streams
  async getStreams(filters?: StreamFilters): Promise<Stream[]> {
    await apiDelay();
    let streams = [...mockStreams];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      streams = streams.filter(stream => 
        stream.name.toLowerCase().includes(search) ||
        stream.class_name?.toLowerCase().includes(search)
      );
    }
    
    if (filters?.class_id) {
      streams = streams.filter(stream => stream.class_assigned === filters.class_id);
    }
    
    if (filters?.academic_year) {
      streams = streams.filter(stream => stream.year === filters.academic_year);
    }
    
    if (filters?.status) {
      streams = streams.filter(stream => stream.status === filters.status);
    }
    
    return streams;
  },

  async getStream(id: number): Promise<Stream | null> {
    await apiDelay();
    return mockStreams.find(stream => stream.id === id) || null;
  },

  async createStream(data: Omit<Stream, 'id' | 'created_at' | 'current_enrollment'>): Promise<Stream> {
    await apiDelay();
    const className = mockClasses.find(c => c.id === data.class_assigned)?.name || '';
    const newStream: Stream = {
      ...data,
      id: Math.max(...mockStreams.map(s => s.id)) + 1,
      class_name: className,
      created_at: new Date().toISOString(),
      current_enrollment: 0
    };
    mockStreams.push(newStream);
    return newStream;
  },

  async updateStream(id: number, data: Partial<Stream>): Promise<Stream | null> {
    await apiDelay();
    const index = mockStreams.findIndex(stream => stream.id === id);
    if (index === -1) return null;
    
    mockStreams[index] = { ...mockStreams[index], ...data };
    return mockStreams[index];
  },

  async deleteStream(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockStreams.findIndex(stream => stream.id === id);
    if (index === -1) return false;
    
    mockStreams.splice(index, 1);
    return true;
  },

  // Class Allocations
  async getClassAllocations(classId?: number, streamId?: number): Promise<ClassAllocation[]> {
    await apiDelay();
    let allocations = [...mockAllocations];
    
    if (classId) {
      allocations = allocations.filter(alloc => alloc.class_id === classId);
    }
    
    if (streamId) {
      allocations = allocations.filter(alloc => alloc.stream_id === streamId);
    }
    
    return allocations;
  },

  async assignStudentToClass(
    studentId: string, 
    classId: number, 
    streamId: number, 
    academicYear: number = 2024,
    term: 1 | 2 | 3 = 1
  ): Promise<ClassAllocation> {
    await apiDelay();
    const allocation: ClassAllocation = {
      id: Date.now().toString(),
      student_id: studentId,
      class_id: classId,
      stream_id: streamId,
      academic_year: academicYear,
      term,
      date_assigned: new Date().toISOString(),
      status: 'current'
    };
    mockAllocations.push(allocation);
    return allocation;
  },

  // Bulk Operations
  async promoteClass(request: BulkPromotionRequest): Promise<{ success: number; errors: string[] }> {
    await apiDelay();
    // Mock promotion logic
    return {
      success: request.student_ids?.length || 0,
      errors: []
    };
  },

  async transferStudent(request: ClassTransferRequest): Promise<boolean> {
    await apiDelay();
    // Mock transfer logic
    const allocationIndex = mockAllocations.findIndex(
      alloc => alloc.student_id === request.student_id && alloc.status === 'current'
    );
    
    if (allocationIndex !== -1) {
      mockAllocations[allocationIndex].status = 'transferred';
      
      // Create new allocation
      const newAllocation: ClassAllocation = {
        id: Date.now().toString(),
        student_id: request.student_id,
        class_id: request.to_class_id,
        stream_id: request.to_stream_id,
        academic_year: 2024,
        term: 1,
        date_assigned: request.transfer_date,
        status: 'current'
      };
      mockAllocations.push(newAllocation);
    }
    
    return true;
  },

  // Statistics
  async getClassStats(): Promise<ClassStats> {
    await apiDelay();
    return {
      total_classes: mockClasses.length,
      total_streams: mockStreams.length,
      total_students_enrolled: mockClasses.reduce((sum, cls) => sum + (cls.total_students || 0), 0),
      average_class_size: 32.5,
      capacity_utilization: 0.78,
      classes_by_grade: {
        1: 1, 2: 1, 3: 1, 9: 1
      },
      enrollment_by_year: [
        { year: 2022, count: 298 },
        { year: 2023, count: 342 },
        { year: 2024, count: 377 }
      ]
    };
  },

  // Student list for class
  async getClassStudents(classId: number, streamId?: number): Promise<Student[]> {
    await apiDelay();
    // This would typically fetch from student service filtered by class/stream
    return [];
  }
};