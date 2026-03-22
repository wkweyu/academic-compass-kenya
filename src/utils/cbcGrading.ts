// Kenya CBC (Competency-Based Curriculum) Grading Utilities

export interface CBCGrade {
  grade: string;
  points: number;
  description: string;
  color: string;
  bgColor: string;
}

export const CBC_GRADES: CBCGrade[] = [
  { grade: 'EE', points: 4, description: 'Exceeding Expectations', color: 'text-green-700', bgColor: 'bg-green-100' },
  { grade: 'ME', points: 3, description: 'Meeting Expectations', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { grade: 'AE', points: 2, description: 'Approaching Expectations', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { grade: 'BE', points: 1, description: 'Below Expectations', color: 'text-red-700', bgColor: 'bg-red-100' },
];

/**
 * Calculate CBC grade from percentage
 * EE: 75-100% (4 points)
 * ME: 50-74% (3 points)
 * AE: 25-49% (2 points)
 * BE: 0-24% (1 point)
 */
export function calculateCBCGrade(marks: number, maxMarks: number): CBCGrade {
  const percentage = (marks / maxMarks) * 100;
  
  if (percentage >= 75) {
    return CBC_GRADES[0]; // EE
  } else if (percentage >= 50) {
    return CBC_GRADES[1]; // ME
  } else if (percentage >= 25) {
    return CBC_GRADES[2]; // AE
  } else {
    return CBC_GRADES[3]; // BE
  }
}

/**
 * Get grade info by grade code
 */
export function getGradeInfo(gradeCode: string): CBCGrade | undefined {
  return CBC_GRADES.find(g => g.grade === gradeCode);
}

/**
 * Calculate average points from an array of grades
 */
export function calculateAveragePoints(grades: string[]): number {
  if (grades.length === 0) return 0;
  
  const totalPoints = grades.reduce((sum, gradeCode) => {
    const grade = getGradeInfo(gradeCode);
    return sum + (grade?.points || 0);
  }, 0);
  
  return Number((totalPoints / grades.length).toFixed(2));
}

/**
 * Calculate overall grade from average points
 */
export function calculateOverallGrade(averagePoints: number): CBCGrade {
  if (averagePoints >= 3.5) {
    return CBC_GRADES[0]; // EE
  } else if (averagePoints >= 2.5) {
    return CBC_GRADES[1]; // ME
  } else if (averagePoints >= 1.5) {
    return CBC_GRADES[2]; // AE
  } else {
    return CBC_GRADES[3]; // BE
  }
}

/**
 * Get grade color classes
 */
export function getGradeColorClasses(gradeCode: string): { color: string; bgColor: string } {
  const grade = getGradeInfo(gradeCode);
  return {
    color: grade?.color || 'text-gray-700',
    bgColor: grade?.bgColor || 'bg-gray-100',
  };
}
