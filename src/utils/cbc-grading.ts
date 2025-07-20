import { CBCGrade, CBC_GRADING_SCALE } from '@/types/cbc';

/**
 * Calculate CBC grade based on marks
 */
export function calculateCBCGrade(marks: number): CBCGrade {
  for (const scale of CBC_GRADING_SCALE) {
    if (marks >= scale.min_score && marks <= scale.max_score) {
      return scale.grade;
    }
  }
  return 'N'; // Default to Needs Improvement
}

/**
 * Get grade information by grade letter
 */
export function getGradeInfo(grade: CBCGrade) {
  return CBC_GRADING_SCALE.find(scale => scale.grade === grade);
}

/**
 * Calculate overall grade from average score
 */
export function calculateOverallGrade(averageScore: number): CBCGrade {
  return calculateCBCGrade(averageScore);
}

/**
 * Get grade color class for display
 */
export function getGradeColor(grade: CBCGrade): string {
  const gradeInfo = getGradeInfo(grade);
  return gradeInfo?.color || 'text-gray-600';
}

/**
 * Format marks with grade for display
 */
export function formatMarksWithGrade(marks: number, maxMarks: number = 100): string {
  const grade = calculateCBCGrade(marks);
  const percentage = Math.round((marks / maxMarks) * 100);
  return `${marks}/${maxMarks} (${percentage}%) - ${grade}`;
}

/**
 * Validate if marks are within valid range
 */
export function validateMarks(marks: number, maxMarks: number = 100): boolean {
  return marks >= 0 && marks <= maxMarks;
}