// Results Service for student academic results
interface StudentResult {
  id: number;
  student_id: number;
  admission_number: string;
  full_name: string;
  class_name: string;
  stream: string;
  total_marks: number;
  total_possible: number;
  percentage: number;
  overall_grade: string;
  position: number;
  subject_results: SubjectResult[];
}

interface SubjectResult {
  subject_name: string;
  subject_code: string;
  marks: number;
  max_marks: number;
  grade: string;
  percentage: number;
}

interface ResultStats {
  total_students: number;
  class_average: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: { [key: string]: number };
}

// Mock data
const mockResults: StudentResult[] = [
  {
    id: 1,
    student_id: 1,
    admission_number: 'ADM001',
    full_name: 'John Kamau',
    class_name: 'Grade 5',
    stream: 'East',
    total_marks: 425,
    total_possible: 500,
    percentage: 85,
    overall_grade: 'M',
    position: 1,
    subject_results: [
      { subject_name: 'Mathematics', subject_code: 'MAT', marks: 92, max_marks: 100, grade: 'E', percentage: 92 },
      { subject_name: 'English', subject_code: 'ENG', marks: 88, max_marks: 100, grade: 'M', percentage: 88 },
      { subject_name: 'Science', subject_code: 'SCI', marks: 85, max_marks: 100, grade: 'M', percentage: 85 },
      { subject_name: 'Kiswahili', subject_code: 'KIS', marks: 80, max_marks: 100, grade: 'M', percentage: 80 },
      { subject_name: 'Social Studies', subject_code: 'SST', marks: 80, max_marks: 100, grade: 'M', percentage: 80 }
    ]
  },
  {
    id: 2,
    student_id: 2,
    admission_number: 'ADM002',
    full_name: 'Mary Wanjiku',
    class_name: 'Grade 5',
    stream: 'East',
    total_marks: 410,
    total_possible: 500,
    percentage: 82,
    overall_grade: 'M',
    position: 2,
    subject_results: [
      { subject_name: 'Mathematics', subject_code: 'MAT', marks: 85, max_marks: 100, grade: 'M', percentage: 85 },
      { subject_name: 'English', subject_code: 'ENG', marks: 90, max_marks: 100, grade: 'E', percentage: 90 },
      { subject_name: 'Science', subject_code: 'SCI', marks: 82, max_marks: 100, grade: 'M', percentage: 82 },
      { subject_name: 'Kiswahili', subject_code: 'KIS', marks: 78, max_marks: 100, grade: 'A', percentage: 78 },
      { subject_name: 'Social Studies', subject_code: 'SST', marks: 75, max_marks: 100, grade: 'A', percentage: 75 }
    ]
  },
  {
    id: 3,
    student_id: 3,
    admission_number: 'ADM003',
    full_name: 'Peter Ochieng',
    class_name: 'Grade 5',
    stream: 'East',
    total_marks: 375,
    total_possible: 500,
    percentage: 75,
    overall_grade: 'A',
    position: 3,
    subject_results: [
      { subject_name: 'Mathematics', subject_code: 'MAT', marks: 78, max_marks: 100, grade: 'A', percentage: 78 },
      { subject_name: 'English', subject_code: 'ENG', marks: 75, max_marks: 100, grade: 'A', percentage: 75 },
      { subject_name: 'Science', subject_code: 'SCI', marks: 72, max_marks: 100, grade: 'A', percentage: 72 },
      { subject_name: 'Kiswahili', subject_code: 'KIS', marks: 75, max_marks: 100, grade: 'A', percentage: 75 },
      { subject_name: 'Social Studies', subject_code: 'SST', marks: 75, max_marks: 100, grade: 'A', percentage: 75 }
    ]
  },
  {
    id: 4,
    student_id: 4,
    admission_number: 'ADM004',
    full_name: 'Grace Njeri',
    class_name: 'Grade 4',
    stream: 'West',
    total_marks: 320,
    total_possible: 400,
    percentage: 80,
    overall_grade: 'M',
    position: 1,
    subject_results: [
      { subject_name: 'Mathematics', subject_code: 'MAT', marks: 85, max_marks: 100, grade: 'M', percentage: 85 },
      { subject_name: 'English', subject_code: 'ENG', marks: 82, max_marks: 100, grade: 'M', percentage: 82 },
      { subject_name: 'Kiswahili', subject_code: 'KIS', marks: 78, max_marks: 100, grade: 'A', percentage: 78 },
      { subject_name: 'Environmental Studies', subject_code: 'ENV', marks: 75, max_marks: 100, grade: 'A', percentage: 75 }
    ]
  }
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));

export const resultsService = {
  async getClassResults(className: string, term: number, year: number): Promise<StudentResult[]> {
    await apiDelay();
    
    // Filter results by class
    return mockResults
      .filter(result => result.class_name === className)
      .sort((a, b) => a.position - b.position);
  },

  async getStudentResults(studentId: number, year: number): Promise<StudentResult[]> {
    await apiDelay();
    return mockResults.filter(result => result.student_id === studentId);
  },

  async getResultsStats(className: string, term: number, year: number): Promise<ResultStats> {
    await apiDelay();
    
    const classResults = mockResults.filter(result => result.class_name === className);
    
    if (classResults.length === 0) {
      return {
        total_students: 0,
        class_average: 0,
        highest_score: 0,
        lowest_score: 0,
        grade_distribution: {}
      };
    }
    
    const percentages = classResults.map(r => r.percentage);
    const grades = classResults.map(r => r.overall_grade);
    
    const gradeDistribution = grades.reduce((acc, grade) => {
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    return {
      total_students: classResults.length,
      class_average: Math.round(percentages.reduce((sum, p) => sum + p, 0) / percentages.length),
      highest_score: Math.max(...percentages),
      lowest_score: Math.min(...percentages),
      grade_distribution: gradeDistribution
    };
  },

  async exportResults(className: string, term: number, year: number): Promise<Blob> {
    await apiDelay();
    
    const results = await this.getClassResults(className, term, year);
    
    // Create CSV content
    const headers = [
      'Position', 'Admission No.', 'Student Name', 'Class', 
      'Total Marks', 'Total Possible', 'Percentage', 'Overall Grade'
    ];
    
    // Add subject headers
    const subjectHeaders = results[0]?.subject_results.map(s => s.subject_code) || [];
    headers.push(...subjectHeaders);
    
    const rows = results.map(result => {
      const baseRow = [
        result.position,
        result.admission_number,
        result.full_name,
        `${result.class_name} ${result.stream}`,
        result.total_marks,
        result.total_possible,
        result.percentage,
        result.overall_grade
      ];
      
      // Add subject grades
      const subjectGrades = result.subject_results.map(s => `${s.marks}/${s.max_marks} (${s.grade})`);
      baseRow.push(...subjectGrades);
      
      return baseRow;
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    return new Blob([csvContent], { type: 'text/csv' });
  }
};