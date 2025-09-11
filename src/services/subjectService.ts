// Subject Service for managing school subjects
interface Subject {
  id: number;
  name: string;
  code: string;
  description: string;
  is_core: boolean;
  grade_levels: string;
  school: number;
  created_at: string;
  updated_at: string;
  assigned_teachers?: number;
  total_students?: number;
}

interface SubjectFilters {
  search?: string;
  is_core?: boolean;
  grade_level?: number;
}

interface SubjectStats {
  total_subjects: number;
  core_subjects: number;
  elective_subjects: number;
  subjects_by_grade: { [key: string]: number };
}

// Mock data
const mockSubjects: Subject[] = [
  {
    id: 1,
    name: 'Mathematics',
    code: 'MAT',
    description: 'Core subject covering arithmetic, algebra, and geometry',
    is_core: true,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 3,
    total_students: 450
  },
  {
    id: 2,
    name: 'English',
    code: 'ENG',
    description: 'Language and literature studies',
    is_core: true,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 4,
    total_students: 450
  },
  {
    id: 3,
    name: 'Kiswahili',
    code: 'KIS',
    description: 'National language studies',
    is_core: true,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 2,
    total_students: 450
  },
  {
    id: 4,
    name: 'Science and Technology',
    code: 'SCI',
    description: 'Integrated science studies',
    is_core: true,
    grade_levels: '4-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 2,
    total_students: 270
  },
  {
    id: 5,
    name: 'Social Studies',
    code: 'SST',
    description: 'History, geography, and civics',
    is_core: true,
    grade_levels: '4-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 2,
    total_students: 270
  },
  {
    id: 6,
    name: 'Christian Religious Education',
    code: 'CRE',
    description: 'Christian religious studies',
    is_core: false,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 1,
    total_students: 320
  },
  {
    id: 7,
    name: 'Islamic Religious Education',
    code: 'IRE',
    description: 'Islamic religious studies',
    is_core: false,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 1,
    total_students: 130
  },
  {
    id: 8,
    name: 'Physical Education',
    code: 'PE',
    description: 'Physical fitness and sports',
    is_core: true,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 2,
    total_students: 450
  },
  {
    id: 9,
    name: 'Creative Arts',
    code: 'CA',
    description: 'Art, music, and creative expression',
    is_core: true,
    grade_levels: '1-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 2,
    total_students: 450
  },
  {
    id: 10,
    name: 'Agriculture',
    code: 'AGR',
    description: 'Agricultural studies and farming',
    is_core: false,
    grade_levels: '4-8',
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    assigned_teachers: 1,
    total_students: 180
  }
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100));

export const subjectService = {
  async getSubjects(filters?: SubjectFilters): Promise<Subject[]> {
    await apiDelay();
    let subjects = [...mockSubjects];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      subjects = subjects.filter(subject => 
        subject.name.toLowerCase().includes(search) ||
        subject.code.toLowerCase().includes(search)
      );
    }
    
    if (filters?.is_core !== undefined) {
      subjects = subjects.filter(subject => subject.is_core === filters.is_core);
    }
    
    if (filters?.grade_level) {
      subjects = subjects.filter(subject => {
        const levels = subject.grade_levels.split(/[-,]/).map(l => parseInt(l.trim()));
        return levels.includes(filters.grade_level!);
      });
    }
    
    return subjects;
  },

  async getSubject(id: number): Promise<Subject | null> {
    await apiDelay();
    return mockSubjects.find(subject => subject.id === id) || null;
  },

  async createSubject(data: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    await apiDelay();
    
    // Check for duplicate code
    const existingSubject = mockSubjects.find(subject => 
      subject.code.toLowerCase() === data.code.toLowerCase() && subject.school === data.school
    );
    
    if (existingSubject) {
      throw new Error(`A subject with code "${data.code}" already exists`);
    }
    
    const newSubject: Subject = {
      ...data,
      id: Math.max(...mockSubjects.map(s => s.id)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assigned_teachers: 0,
      total_students: 0
    };
    
    mockSubjects.push(newSubject);
    return newSubject;
  },

  async updateSubject(id: number, data: Partial<Subject>): Promise<Subject | null> {
    await apiDelay();
    const index = mockSubjects.findIndex(subject => subject.id === id);
    if (index === -1) return null;
    
    // Check for duplicate code if code is being updated
    if (data.code) {
      const existingSubject = mockSubjects.find(subject => 
        subject.code.toLowerCase() === data.code!.toLowerCase() && 
        subject.school === mockSubjects[index].school && 
        subject.id !== id
      );
      
      if (existingSubject) {
        throw new Error(`A subject with code "${data.code}" already exists`);
      }
    }
    
    const updatedSubject = {
      ...mockSubjects[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    mockSubjects[index] = updatedSubject;
    return updatedSubject;
  },

  async deleteSubject(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockSubjects.findIndex(subject => subject.id === id);
    if (index === -1) return false;
    
    // In real app, check if subject has assignments/scores
    mockSubjects.splice(index, 1);
    return true;
  },

  async getSubjectStats(): Promise<SubjectStats> {
    await apiDelay();
    
    const coreSubjects = mockSubjects.filter(s => s.is_core);
    const electiveSubjects = mockSubjects.filter(s => !s.is_core);
    
    const subjectsByGrade = mockSubjects.reduce((acc, subject) => {
      acc[subject.grade_levels] = (acc[subject.grade_levels] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      total_subjects: mockSubjects.length,
      core_subjects: coreSubjects.length,
      elective_subjects: electiveSubjects.length,
      subjects_by_grade: subjectsByGrade
    };
  }
};