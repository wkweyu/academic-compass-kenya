// Teaching Assignment Service
interface TeachingAssignment {
  id: number;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  class_id: number;
  class_name: string;
  stream_id?: number;
  stream_name?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  is_class_teacher: boolean;
  workload_hours: number;
  created_at: string;
}

interface CreateAssignmentData {
  teacher_id: number;
  subject_id: number;
  class_id: number;
  stream_id?: number;
  academic_year: number;
  term: 1 | 2 | 3;
  is_class_teacher: boolean;
  workload_hours: number;
}

// Mock data
const mockAssignments: TeachingAssignment[] = [
  {
    id: 1,
    teacher_id: 1,
    teacher_name: 'Sarah Johnson',
    subject_id: 1,
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    class_id: 5,
    class_name: 'Grade 5',
    stream_name: 'East',
    academic_year: 2024,
    term: 2,
    is_class_teacher: true,
    workload_hours: 6,
    created_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 2,
    teacher_id: 2,
    teacher_name: 'Michael Ochieng',
    subject_id: 3,
    subject_name: 'Science',
    subject_code: 'SCI',
    class_id: 6,
    class_name: 'Grade 6',
    stream_name: 'North',
    academic_year: 2024,
    term: 2,
    is_class_teacher: false,
    workload_hours: 5,
    created_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 3,
    teacher_id: 3,
    teacher_name: 'Grace Wanjiku',
    subject_id: 2,
    subject_name: 'English',
    subject_code: 'ENG',
    class_id: 4,
    class_name: 'Grade 4',
    stream_name: 'West',
    academic_year: 2024,
    term: 2,
    is_class_teacher: true,
    workload_hours: 7,
    created_at: '2024-01-15T00:00:00Z'
  }
];

// Mock lookup data
const teacherLookup = {
  1: 'Sarah Johnson',
  2: 'Michael Ochieng', 
  3: 'Grace Wanjiku'
};

const subjectLookup = {
  1: { name: 'Mathematics', code: 'MAT' },
  2: { name: 'English', code: 'ENG' },
  3: { name: 'Science', code: 'SCI' }
};

const classLookup = {
  1: 'Grade 1',
  2: 'Grade 2',
  3: 'Grade 3',
  4: 'Grade 4',
  5: 'Grade 5',
  6: 'Grade 6'
};

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

export const teachingAssignmentService = {
  async getAssignments(): Promise<TeachingAssignment[]> {
    await apiDelay();
    return [...mockAssignments];
  },

  async getAssignment(id: number): Promise<TeachingAssignment | null> {
    await apiDelay();
    return mockAssignments.find(assignment => assignment.id === id) || null;
  },

  async getTeacherAssignments(teacherId: number): Promise<TeachingAssignment[]> {
    await apiDelay();
    return mockAssignments.filter(assignment => assignment.teacher_id === teacherId);
  },

  async createAssignment(data: CreateAssignmentData): Promise<TeachingAssignment> {
    await apiDelay();
    
    // Check for duplicate assignment
    const existing = mockAssignments.find(assignment => 
      assignment.teacher_id === data.teacher_id &&
      assignment.subject_id === data.subject_id &&
      assignment.class_id === data.class_id &&
      assignment.academic_year === data.academic_year &&
      assignment.term === data.term
    );
    
    if (existing) {
      throw new Error('This teacher is already assigned to this subject and class for this term');
    }

    // Check if class teacher position is taken
    if (data.is_class_teacher) {
      const existingClassTeacher = mockAssignments.find(assignment =>
        assignment.class_id === data.class_id &&
        assignment.academic_year === data.academic_year &&
        assignment.term === data.term &&
        assignment.is_class_teacher
      );
      
      if (existingClassTeacher) {
        throw new Error('This class already has a class teacher for this term');
      }
    }
    
    const newAssignment: TeachingAssignment = {
      id: Math.max(...mockAssignments.map(a => a.id)) + 1,
      ...data,
      teacher_name: teacherLookup[data.teacher_id as keyof typeof teacherLookup] || 'Unknown Teacher',
      subject_name: subjectLookup[data.subject_id as keyof typeof subjectLookup]?.name || 'Unknown Subject',
      subject_code: subjectLookup[data.subject_id as keyof typeof subjectLookup]?.code || 'UNK',
      class_name: classLookup[data.class_id as keyof typeof classLookup] || 'Unknown Class',
      stream_name: data.stream_id ? 'Stream' : undefined,
      created_at: new Date().toISOString()
    };
    
    mockAssignments.push(newAssignment);
    return newAssignment;
  },

  async updateAssignment(id: number, data: Partial<CreateAssignmentData>): Promise<TeachingAssignment | null> {
    await apiDelay();
    const index = mockAssignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return null;
    
    const updatedAssignment: TeachingAssignment = {
      ...mockAssignments[index],
      ...data,
      teacher_name: data.teacher_id ? (teacherLookup[data.teacher_id as keyof typeof teacherLookup] || mockAssignments[index].teacher_name) : mockAssignments[index].teacher_name,
      subject_name: data.subject_id ? (subjectLookup[data.subject_id as keyof typeof subjectLookup]?.name || mockAssignments[index].subject_name) : mockAssignments[index].subject_name,
      subject_code: data.subject_id ? (subjectLookup[data.subject_id as keyof typeof subjectLookup]?.code || mockAssignments[index].subject_code) : mockAssignments[index].subject_code,
      class_name: data.class_id ? (classLookup[data.class_id as keyof typeof classLookup] || mockAssignments[index].class_name) : mockAssignments[index].class_name
    };
    
    mockAssignments[index] = updatedAssignment;
    return updatedAssignment;
  },

  async deleteAssignment(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockAssignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return false;
    
    mockAssignments.splice(index, 1);
    return true;
  }
};