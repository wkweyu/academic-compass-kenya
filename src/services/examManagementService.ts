import { supabase } from "@/integrations/supabase/client";
import { calculateCBCGrade } from "@/utils/cbcGrading";

export interface ExamType {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  school_id: number;
}

export interface Exam {
  id: number;
  name: string;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  class_id: number;
  class_name: string;
  stream_id: number | null;
  stream_name: string | null;
  exam_type_id: number;
  exam_type_name: string;
  term_id: number;
  term_number: number;
  academic_year: number;
  exam_date: string;
  max_marks: number;
  duration_minutes: number;
  instructions: string;
  is_published: boolean;
  created_at: string;
  // Statistics
  total_students?: number;
  scores_entered?: number;
  class_average?: number;
}

export interface StudentScore {
  id?: number;
  student_id: number;
  admission_number: string;
  full_name: string;
  exam_id: number;
  marks: number;
  grade: string;
  points: number;
  remarks: string;
  is_absent: boolean;
}

export interface ClassMeritEntry {
  position: number;
  student_id: number;
  admission_number: string;
  full_name: string;
  stream_name: string | null;
  total_marks: number;
  total_possible: number;
  percentage: number;
  average_points: number;
  overall_grade: string;
  subjects_count: number;
}

export interface SubjectAnalysis {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  exam_name: string;
  total_students: number;
  scores_entered: number;
  class_average: number;
  highest_score: number;
  lowest_score: number;
  grade_distribution: Record<string, number>;
}

export const examManagementService = {
  // ============ EXAM TYPES ============
  async getExamTypes(): Promise<ExamType[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    const { data, error } = await supabase
      .from('exams_examtype')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  async createExamType(examType: Omit<ExamType, 'id' | 'school_id'>): Promise<ExamType> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    const { data, error } = await supabase
      .from('exams_examtype')
      .insert({
        ...examType,
        school_id: schoolId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateExamType(id: number, updates: Partial<ExamType>): Promise<ExamType> {
    const { data, error } = await supabase
      .from('exams_examtype')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteExamType(id: number): Promise<void> {
    const { error } = await supabase
      .from('exams_examtype')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // ============ EXAMS ============
  async getExams(filters?: {
    class_id?: number;
    subject_id?: number;
    term_id?: number;
    academic_year?: number;
    exam_type_id?: number;
    search?: string;
  }): Promise<Exam[]> {
    let query = supabase
      .from('exams_exam')
      .select(`
        *,
        subject:subjects(name, code),
        class:classes(name),
        stream:streams(name),
        exam_type:exams_examtype(name),
        term:settings_termsetting(term, year)
      `)
      .order('exam_date', { ascending: false });
    
    if (filters?.class_id) query = query.eq('class_assigned_id', filters.class_id);
    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);
    if (filters?.term_id) query = query.eq('term_id', filters.term_id);
    if (filters?.academic_year) query = query.eq('academic_year', filters.academic_year);
    if (filters?.exam_type_id) query = query.eq('exam_type_id', filters.exam_type_id);
    if (filters?.search) query = query.ilike('name', `%${filters.search}%`);
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Get score counts for each exam
    const examsWithStats = await Promise.all((data || []).map(async (exam: any) => {
      const { count: scoresEntered } = await supabase
        .from('scores')
        .select('*', { count: 'exact', head: true })
        .eq('exam_id', exam.id);
      
      // Get total students for this class/stream
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('current_class_id', exam.class_assigned_id)
        .eq('is_active', true);
      
      if (exam.stream_id) {
        studentQuery = studentQuery.eq('current_stream_id', exam.stream_id);
      }
      
      const { count: totalStudents } = await studentQuery;
      
      // Get class average
      const { data: avgData } = await supabase
        .from('scores')
        .select('marks')
        .eq('exam_id', exam.id);
      
      const classAverage = avgData && avgData.length > 0
        ? avgData.reduce((sum, s) => sum + Number(s.marks), 0) / avgData.length
        : 0;
      
      return {
        id: exam.id,
        name: exam.name,
        subject_id: exam.subject_id,
        subject_name: exam.subject?.name || '',
        subject_code: exam.subject?.code || '',
        class_id: exam.class_assigned_id,
        class_name: exam.class?.name || '',
        stream_id: exam.stream_id,
        stream_name: exam.stream?.name || null,
        exam_type_id: exam.exam_type_id,
        exam_type_name: exam.exam_type?.name || '',
        term_id: exam.term_id,
        term_number: exam.term?.term || 0,
        academic_year: exam.academic_year,
        exam_date: exam.exam_date,
        max_marks: exam.max_marks,
        duration_minutes: exam.duration_minutes,
        instructions: exam.instructions,
        is_published: exam.is_published,
        created_at: exam.created_at,
        total_students: totalStudents || 0,
        scores_entered: scoresEntered || 0,
        class_average: Number(classAverage.toFixed(1)),
      };
    }));
    
    return examsWithStats;
  },

  async createExam(exam: {
    name: string;
    subject_id: number;
    class_id: number;
    stream_id?: number;
    exam_type_id: number;
    term_id: number;
    academic_year: number;
    exam_date: string;
    max_marks: number;
    duration_minutes: number;
    instructions?: string;
  }): Promise<Exam> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    const { data, error } = await supabase
      .from('exams_exam')
      .insert({
        name: exam.name,
        subject_id: exam.subject_id,
        class_assigned_id: exam.class_id,
        stream_id: exam.stream_id || null,
        exam_type_id: exam.exam_type_id,
        term_id: exam.term_id,
        academic_year: exam.academic_year,
        exam_date: exam.exam_date,
        max_marks: exam.max_marks,
        duration_minutes: exam.duration_minutes,
        instructions: exam.instructions || '',
        is_published: false,
        school_id: schoolId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateExam(id: number, updates: Partial<Exam>): Promise<void> {
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.subject_id !== undefined) updateData.subject_id = updates.subject_id;
    if (updates.class_id !== undefined) updateData.class_assigned_id = updates.class_id;
    if (updates.stream_id !== undefined) updateData.stream_id = updates.stream_id;
    if (updates.exam_type_id !== undefined) updateData.exam_type_id = updates.exam_type_id;
    if (updates.term_id !== undefined) updateData.term_id = updates.term_id;
    if (updates.academic_year !== undefined) updateData.academic_year = updates.academic_year;
    if (updates.exam_date !== undefined) updateData.exam_date = updates.exam_date;
    if (updates.max_marks !== undefined) updateData.max_marks = updates.max_marks;
    if (updates.duration_minutes !== undefined) updateData.duration_minutes = updates.duration_minutes;
    if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
    if (updates.is_published !== undefined) updateData.is_published = updates.is_published;

    const { error } = await supabase
      .from('exams_exam')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  },

  async deleteExam(id: number): Promise<void> {
    // First delete scores
    await supabase.from('scores').delete().eq('exam_id', id);
    
    const { error } = await supabase
      .from('exams_exam')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async publishExam(id: number): Promise<void> {
    const { error } = await supabase
      .from('exams_exam')
      .update({ is_published: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw error;
  },

  // ============ SCORES / MARKS ENTRY ============
  async getStudentsForExam(examId: number): Promise<StudentScore[]> {
    // Get exam details first
    const { data: exam, error: examError } = await supabase
      .from('exams_exam')
      .select('class_assigned_id, stream_id, max_marks')
      .eq('id', examId)
      .single();
    
    if (examError) throw examError;
    
    // Get students
    let studentQuery = supabase
      .from('students')
      .select('id, admission_number, full_name')
      .eq('current_class_id', exam.class_assigned_id)
      .eq('is_active', true)
      .order('full_name');
    
    if (exam.stream_id) {
      studentQuery = studentQuery.eq('current_stream_id', exam.stream_id);
    }
    
    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) throw studentsError;
    
    // Get existing scores
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .eq('exam_id', examId);
    
    if (scoresError) throw scoresError;
    
    const scoresMap = new Map(scores?.map(s => [s.student_id, s]) || []);
    
    return (students || []).map(student => {
      const existingScore = scoresMap.get(student.id);
      return {
        id: existingScore?.id,
        student_id: student.id,
        admission_number: student.admission_number,
        full_name: student.full_name,
        exam_id: examId,
        marks: existingScore?.marks || 0,
        grade: existingScore?.grade || '',
        points: existingScore?.grade ? (calculateCBCGrade(existingScore.marks, exam.max_marks).points) : 0,
        remarks: existingScore?.remarks || '',
        is_absent: existingScore?.is_absent || false,
      };
    });
  },

  async saveScores(examId: number, scores: StudentScore[], maxMarks: number): Promise<void> {
    const scoresToSave = scores
      .filter(s => s.marks > 0 || s.is_absent)
      .map(s => {
        const gradeInfo = calculateCBCGrade(s.marks, maxMarks);
        return {
          exam_id: examId,
          student_id: s.student_id,
          marks: s.marks,
          grade: gradeInfo.grade,
          remarks: s.remarks || '',
          is_absent: s.is_absent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
    
    if (scoresToSave.length === 0) return;
    
    const { error } = await supabase
      .from('scores')
      .upsert(scoresToSave, { onConflict: 'exam_id,student_id' });
    
    if (error) throw error;
  },

  // ============ CLASS MERIT LIST ============
  async getClassMeritList(classId: number, termId: number, academicYear: number, streamId?: number): Promise<ClassMeritEntry[]> {
    // Get all students in the class/stream
    let studentQuery = supabase
      .from('students')
      .select('id, admission_number, full_name, current_stream_id, stream:streams(name)')
      .eq('current_class_id', classId)
      .eq('is_active', true);
    
    if (streamId) {
      studentQuery = studentQuery.eq('current_stream_id', streamId);
    }
    
    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) throw studentsError;
    
    // Get all exams for this class/term/year
    let examQuery = supabase
      .from('exams_exam')
      .select('id, max_marks, subject_id')
      .eq('class_assigned_id', classId)
      .eq('term_id', termId)
      .eq('academic_year', academicYear)
      .eq('is_published', true);
    
    if (streamId) {
      examQuery = examQuery.or(`stream_id.eq.${streamId},stream_id.is.null`);
    }
    
    const { data: exams, error: examsError } = await examQuery;
    if (examsError) throw examsError;
    
    if (!exams || exams.length === 0) {
      return [];
    }
    
    const examIds = exams.map(e => e.id);
    const maxMarksByExam = new Map(exams.map(e => [e.id, e.max_marks]));
    
    // Get all scores for these exams
    const { data: allScores, error: scoresError } = await supabase
      .from('scores')
      .select('*')
      .in('exam_id', examIds);
    
    if (scoresError) throw scoresError;
    
    // Calculate results for each student
    const results: ClassMeritEntry[] = (students || []).map((student: any) => {
      const studentScores = (allScores || []).filter(s => s.student_id === student.id);
      
      const totalMarks = studentScores.reduce((sum, s) => sum + Number(s.marks), 0);
      const totalPossible = studentScores.reduce((sum, s) => sum + (maxMarksByExam.get(s.exam_id) || 0), 0);
      const percentage = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;
      
      const grades = studentScores.map(s => s.grade).filter(Boolean);
      const totalPoints = grades.reduce((sum, g) => {
        const gradeInfo = { 'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1 }[g] || 0;
        return sum + gradeInfo;
      }, 0);
      const averagePoints = grades.length > 0 ? totalPoints / grades.length : 0;
      
      // Determine overall grade from average points
      let overallGrade = 'BE';
      if (averagePoints >= 3.5) overallGrade = 'EE';
      else if (averagePoints >= 2.5) overallGrade = 'ME';
      else if (averagePoints >= 1.5) overallGrade = 'AE';
      
      return {
        position: 0, // Will be calculated after sorting
        student_id: student.id,
        admission_number: student.admission_number,
        full_name: student.full_name,
        stream_name: student.stream?.name || null,
        total_marks: Number(totalMarks.toFixed(1)),
        total_possible: totalPossible,
        percentage: Number(percentage.toFixed(2)),
        average_points: Number(averagePoints.toFixed(2)),
        overall_grade: overallGrade,
        subjects_count: grades.length,
      };
    });
    
    // Sort by average points (descending), then by percentage
    results.sort((a, b) => {
      if (b.average_points !== a.average_points) {
        return b.average_points - a.average_points;
      }
      return b.percentage - a.percentage;
    });
    
    // Assign positions
    results.forEach((r, idx) => {
      r.position = idx + 1;
    });
    
    return results;
  },

  // ============ SUBJECT ANALYSIS ============
  async getSubjectAnalysis(classId: number, termId: number, academicYear: number): Promise<SubjectAnalysis[]> {
    // Get all exams for this class/term/year grouped by subject
    const { data: exams, error: examsError } = await supabase
      .from('exams_exam')
      .select(`
        id, name, max_marks, subject_id,
        subject:subjects(name, code)
      `)
      .eq('class_assigned_id', classId)
      .eq('term_id', termId)
      .eq('academic_year', academicYear)
      .eq('is_published', true);
    
    if (examsError) throw examsError;
    
    // Get student count for this class
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('current_class_id', classId)
      .eq('is_active', true);
    
    const analyses: SubjectAnalysis[] = [];
    
    for (const exam of exams || []) {
      const { data: scores } = await supabase
        .from('scores')
        .select('marks, grade')
        .eq('exam_id', exam.id);
      
      const scoresEntered = scores?.length || 0;
      const marks = scores?.map(s => Number(s.marks)) || [];
      
      const gradeDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
      scores?.forEach(s => {
        if (s.grade && gradeDistribution[s.grade] !== undefined) {
          gradeDistribution[s.grade]++;
        }
      });
      
      analyses.push({
        subject_id: exam.subject_id,
        subject_name: (exam.subject as any)?.name || '',
        subject_code: (exam.subject as any)?.code || '',
        exam_name: exam.name,
        total_students: totalStudents || 0,
        scores_entered: scoresEntered,
        class_average: marks.length > 0 ? Number((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1)) : 0,
        highest_score: marks.length > 0 ? Math.max(...marks) : 0,
        lowest_score: marks.length > 0 ? Math.min(...marks) : 0,
        grade_distribution: gradeDistribution,
      });
    }
    
    return analyses.sort((a, b) => b.class_average - a.class_average);
  },

  // ============ STUDENT REPORT CARD ============
  async getStudentReportCard(studentId: number, termId: number, academicYear: number): Promise<{
    student: any;
    subjects: any[];
    summary: any;
  }> {
    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id, admission_number, full_name, date_of_birth, gender,
        class:classes(name),
        stream:streams(name)
      `)
      .eq('id', studentId)
      .single();
    
    if (studentError) throw studentError;
    
    // Get all scores for this student in the term
    const { data: scores, error: scoresError } = await supabase
      .from('scores')
      .select(`
        marks, grade, remarks,
        exam:exams_exam(
          name, max_marks, exam_date,
          subject:subjects(name, code),
          exam_type:exams_examtype(name)
        )
      `)
      .eq('student_id', studentId)
      .eq('exam.term_id', termId)
      .eq('exam.academic_year', academicYear);
    
    if (scoresError) throw scoresError;
    
    // Group by subject
    const subjectMap = new Map<number, any>();
    
    (scores || []).forEach((score: any) => {
      if (!score.exam) return;
      
      const subjectId = score.exam.subject?.code;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subject_name: score.exam.subject?.name || '',
          subject_code: score.exam.subject?.code || '',
          exams: [],
        });
      }
      
      const percentage = (score.marks / score.exam.max_marks) * 100;
      const gradeInfo = calculateCBCGrade(score.marks, score.exam.max_marks);
      
      subjectMap.get(subjectId).exams.push({
        exam_name: score.exam.name,
        exam_type: score.exam.exam_type?.name || '',
        marks: score.marks,
        max_marks: score.exam.max_marks,
        percentage: Number(percentage.toFixed(1)),
        grade: score.grade,
        points: gradeInfo.points,
        remarks: score.remarks,
      });
    });
    
    const subjects = Array.from(subjectMap.values());
    
    // Calculate summary
    const allGrades = (scores || []).map((s: any) => s.grade).filter(Boolean);
    const totalPoints = allGrades.reduce((sum, g) => {
      const pts = { 'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1 }[g] || 0;
      return sum + pts;
    }, 0);
    const averagePoints = allGrades.length > 0 ? totalPoints / allGrades.length : 0;
    
    const totalMarks = (scores || []).reduce((sum, s: any) => sum + Number(s.marks), 0);
    const totalPossible = (scores || []).reduce((sum, s: any) => sum + (s.exam?.max_marks || 0), 0);
    const overallPercentage = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;
    
    let overallGrade = 'BE';
    if (averagePoints >= 3.5) overallGrade = 'EE';
    else if (averagePoints >= 2.5) overallGrade = 'ME';
    else if (averagePoints >= 1.5) overallGrade = 'AE';
    
    return {
      student: {
        ...student,
        class_name: (student.class as any)?.name || '',
        stream_name: (student.stream as any)?.name || '',
      },
      subjects,
      summary: {
        total_subjects: subjects.length,
        total_exams: allGrades.length,
        total_marks: Number(totalMarks.toFixed(1)),
        total_possible: totalPossible,
        overall_percentage: Number(overallPercentage.toFixed(1)),
        average_points: Number(averagePoints.toFixed(2)),
        overall_grade: overallGrade,
      },
    };
  },

  // ============ EXPORT ============
  async exportClassMeritList(classId: number, termId: number, academicYear: number): Promise<Blob> {
    const meritList = await this.getClassMeritList(classId, termId, academicYear);
    
    const headers = ['Position', 'Admission No.', 'Student Name', 'Stream', 'Total Marks', 'Percentage', 'Avg Points', 'Grade', 'Subjects'];
    const rows = meritList.map(entry => [
      entry.position,
      entry.admission_number,
      entry.full_name,
      entry.stream_name || '',
      `${entry.total_marks}/${entry.total_possible}`,
      `${entry.percentage}%`,
      entry.average_points,
      entry.overall_grade,
      entry.subjects_count,
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  },
};
