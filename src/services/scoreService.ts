// Score Service for managing exam scores
interface Student {
  id: number;
  admission_number: string;
  full_name: string;
  current_class: string;
  stream: string;
}

interface Score {
  id?: number;
  student_id: number;
  exam_id: number;
  marks: number;
  grade: string;
  remarks?: string;
}

interface Exam {
  id: number;
  name: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  stream: string;
  max_marks: number;
  term: number;
  academic_year: number;
}

// Mock data
const mockExams: Exam[] = [
  {
    id: 1,
    name: 'Mathematics CAT 1',
    subject_name: 'Mathematics',
    subject_code: 'MAT',
    class_name: 'Grade 5',
    stream: 'East',
    max_marks: 100,
    term: 2,
    academic_year: 2024
  },
  {
    id: 2,
    name: 'English End Term',
    subject_name: 'English',
    subject_code: 'ENG',
    class_name: 'Grade 4',
    stream: 'West',
    max_marks: 100,
    term: 2,
    academic_year: 2024
  },
  {
    id: 3,
    name: 'Science Mid Term',
    subject_name: 'Science',
    subject_code: 'SCI',
    class_name: 'Grade 6',
    stream: 'North',
    max_marks: 80,
    term: 2,
    academic_year: 2024
  }
];

const mockStudents: Student[] = [
  {
    id: 1,
    admission_number: 'ADM001',
    full_name: 'John Kamau',
    current_class: 'Grade 5',
    stream: 'East'
  },
  {
    id: 2,
    admission_number: 'ADM002',
    full_name: 'Mary Wanjiku',
    current_class: 'Grade 5',
    stream: 'East'
  },
  {
    id: 3,
    admission_number: 'ADM003',
    full_name: 'Peter Ochieng',
    current_class: 'Grade 5',
    stream: 'East'
  },
  {
    id: 4,
    admission_number: 'ADM004',
    full_name: 'Grace Njeri',
    current_class: 'Grade 4',
    stream: 'West'
  },
  {
    id: 5,
    admission_number: 'ADM005',
    full_name: 'David Mwangi',
    current_class: 'Grade 6',
    stream: 'North'
  }
];

const mockScores: Score[] = [
  {
    id: 1,
    student_id: 1,
    exam_id: 1,
    marks: 85,
    grade: 'M'
  },
  {
    id: 2,
    student_id: 2,
    exam_id: 1,
    marks: 92,
    grade: 'E'
  }
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

export const scoreService = {
  async getExams(): Promise<Exam[]> {
    await apiDelay();
    return mockExams;
  },

  async getStudentsForExam(examId: number): Promise<Student[]> {
    await apiDelay();
    const exam = mockExams.find(e => e.id === examId);
    if (!exam) return [];
    
    // Filter students by class and stream
    return mockStudents.filter(student => 
      student.current_class === exam.class_name && 
      student.stream === exam.stream
    );
  },

  async getScores(examId: number): Promise<Score[]> {
    await apiDelay();
    return mockScores.filter(score => score.exam_id === examId);
  },

  async saveScores(scores: Score[]): Promise<void> {
    await apiDelay();
    
    scores.forEach(score => {
      const existingIndex = mockScores.findIndex(s => 
        s.student_id === score.student_id && s.exam_id === score.exam_id
      );
      
      if (existingIndex >= 0) {
        // Update existing score
        mockScores[existingIndex] = { ...score, id: mockScores[existingIndex].id };
      } else {
        // Add new score
        const newScore = { ...score, id: Math.max(...mockScores.map(s => s.id || 0)) + 1 };
        mockScores.push(newScore);
      }
    });
  },

  async exportScores(examId: number): Promise<Blob> {
    await apiDelay();
    
    const exam = mockExams.find(e => e.id === examId);
    const students = await this.getStudentsForExam(examId);
    const scores = await this.getScores(examId);
    
    if (!exam) throw new Error('Exam not found');
    
    // Create CSV content
    const headers = ['Admission No.', 'Student Name', 'Class', 'Marks', 'Grade'];
    const rows = students.map(student => {
      const score = scores.find(s => s.student_id === student.id);
      return [
        student.admission_number,
        student.full_name,
        `${student.current_class} ${student.stream}`,
        score?.marks || 0,
        score?.grade || 'N/A'
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    return new Blob([csvContent], { type: 'text/csv' });
  }
};