import { supabase } from "@/integrations/supabase/client";
import {
  ExamSession,
  ExamSessionClass,
  ExamPaper,
  ExamMark,
  StudentExamResult,
  CreateExamSessionData,
  CreateExamPaperData,
  ClassMeritListEntry,
  SubjectPerformance,
  calculateCBCGrade,
} from "@/types/exam-management";

export const examSessionService = {
  // ============ EXAM SESSIONS ============
  async getExamSessions(): Promise<ExamSession[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        *,
        term:settings_termsetting(term, year)
      `)
      .eq('school_id', schoolId)
      .order('academic_year', { ascending: false })
      .order('start_date', { ascending: false });

    if (error) throw error;

    // Get class and paper counts
    const sessionsWithStats = await Promise.all((data || []).map(async (session: any) => {
      const [classesRes, papersRes] = await Promise.all([
        supabase.from('exam_session_classes').select('*', { count: 'exact', head: true }).eq('exam_session_id', session.id),
        supabase.from('exam_papers').select('*', { count: 'exact', head: true }).eq('exam_session_id', session.id),
      ]);

      // Calculate completion percentage
      const { data: papers } = await supabase
        .from('exam_papers')
        .select('id, status')
        .eq('exam_session_id', session.id);

      const completedPapers = papers?.filter(p => p.status === 'completed' || p.status === 'locked').length || 0;
      const totalPapers = papers?.length || 0;

      return {
        ...session,
        term_number: session.term?.term,
        term_year: session.term?.year,
        classes_count: classesRes.count || 0,
        papers_count: papersRes.count || 0,
        completion_percentage: totalPapers > 0 ? Math.round((completedPapers / totalPapers) * 100) : 0,
      };
    }));

    return sessionsWithStats;
  },

  async getExamSession(id: number): Promise<ExamSession | null> {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select(`
        *,
        term:settings_termsetting(term, year)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? {
      ...data,
      term_number: (data as any).term?.term,
      term_year: (data as any).term?.year,
    } : null;
  },

  async createExamSession(data: CreateExamSessionData): Promise<ExamSession> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .insert({
        school_id: schoolId,
        name: data.name,
        description: data.description || null,
        term_id: data.term_id,
        academic_year: data.academic_year,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'upcoming',
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Add classes
    if (data.class_ids.length > 0) {
      const classInserts = data.class_ids.map(class_id => ({
        exam_session_id: session.id,
        class_id,
      }));

      const { error: classesError } = await supabase
        .from('exam_session_classes')
        .insert(classInserts);

      if (classesError) throw classesError;
    }

    return session;
  },

  async updateExamSession(id: number, updates: Partial<ExamSession>): Promise<void> {
    const { error } = await supabase
      .from('exam_sessions')
      .update({
        name: updates.name,
        description: updates.description,
        start_date: updates.start_date,
        end_date: updates.end_date,
        status: updates.status,
        is_locked: updates.is_locked,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteExamSession(id: number): Promise<void> {
    const { error } = await supabase
      .from('exam_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getSessionClasses(sessionId: number): Promise<ExamSessionClass[]> {
    const { data, error } = await supabase
      .from('exam_session_classes')
      .select(`
        *,
        class:classes(name)
      `)
      .eq('exam_session_id', sessionId);

    if (error) throw error;
    return (data || []).map((item: any) => ({
      ...item,
      class_name: item.class?.name,
    }));
  },

  // ============ EXAM PAPERS ============
  async getExamPapers(sessionId: number, classId?: number): Promise<ExamPaper[]> {
    let query = supabase
      .from('exam_papers')
      .select(`
        *,
        class:classes(name),
        stream:streams(name),
        subject:subjects(name, code)
      `)
      .eq('exam_session_id', sessionId)
      .order('class_id')
      .order('subject_id');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get marks statistics for each paper
    const papersWithStats = await Promise.all((data || []).map(async (paper: any) => {
      // Get student count
      let studentQuery = supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('current_class_id', paper.class_id)
        .eq('is_active', true);

      if (paper.stream_id) {
        studentQuery = studentQuery.eq('current_stream_id', paper.stream_id);
      }

      const { count: totalStudents } = await studentQuery;

      // Get marks count and average
      const { data: marksData, count: marksEntered } = await supabase
        .from('exam_marks')
        .select('marks', { count: 'exact' })
        .eq('exam_paper_id', paper.id)
        .not('marks', 'is', null);

      const classAverage = marksData && marksData.length > 0
        ? marksData.reduce((sum, m) => sum + Number(m.marks), 0) / marksData.length
        : 0;

      return {
        ...paper,
        class_name: paper.class?.name,
        stream_name: paper.stream?.name,
        subject_name: paper.subject?.name,
        subject_code: paper.subject?.code,
        total_students: totalStudents || 0,
        marks_entered: marksEntered || 0,
        class_average: Number(classAverage.toFixed(1)),
      };
    }));

    return papersWithStats;
  },

  async createExamPaper(data: CreateExamPaperData): Promise<ExamPaper> {
    const { data: paper, error } = await supabase
      .from('exam_papers')
      .insert({
        exam_session_id: data.exam_session_id,
        class_id: data.class_id,
        stream_id: data.stream_id || null,
        subject_id: data.subject_id,
        paper_name: data.paper_name,
        max_marks: data.max_marks,
        weight: data.weight || 1.0,
        exam_date: data.exam_date || null,
        duration_minutes: data.duration_minutes || 60,
        instructions: data.instructions || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) throw error;
    return paper;
  },

  async createBulkExamPapers(sessionId: number, classId: number, subjects: { subject_id: number; paper_name: string; max_marks: number }[]): Promise<void> {
    const papers = subjects.map(s => ({
      exam_session_id: sessionId,
      class_id: classId,
      subject_id: s.subject_id,
      paper_name: s.paper_name,
      max_marks: s.max_marks,
      status: 'draft',
    }));

    const { error } = await supabase
      .from('exam_papers')
      .insert(papers);

    if (error) throw error;
  },

  async updateExamPaper(id: number, updates: Partial<ExamPaper>): Promise<void> {
    const { error } = await supabase
      .from('exam_papers')
      .update({
        paper_name: updates.paper_name,
        max_marks: updates.max_marks,
        weight: updates.weight,
        exam_date: updates.exam_date,
        duration_minutes: updates.duration_minutes,
        instructions: updates.instructions,
        status: updates.status,
      })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteExamPaper(id: number): Promise<void> {
    const { error } = await supabase
      .from('exam_papers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ============ MARKS ENTRY ============
  async getStudentsForPaper(paperId: number): Promise<ExamMark[]> {
    // Get paper details
    const { data: paper, error: paperError } = await supabase
      .from('exam_papers')
      .select('class_id, stream_id, max_marks')
      .eq('id', paperId)
      .single();

    if (paperError) throw paperError;

    // Get students
    let studentQuery = supabase
      .from('students')
      .select('id, admission_number, full_name')
      .eq('current_class_id', paper.class_id)
      .eq('is_active', true)
      .order('full_name');

    if (paper.stream_id) {
      studentQuery = studentQuery.eq('current_stream_id', paper.stream_id);
    }

    const { data: students, error: studentsError } = await studentQuery;
    if (studentsError) throw studentsError;

    // Get existing marks
    const { data: marks, error: marksError } = await supabase
      .from('exam_marks')
      .select('*')
      .eq('exam_paper_id', paperId);

    if (marksError) throw marksError;

    const marksMap = new Map(marks?.map(m => [m.student_id, m]) || []);

    return (students || []).map(student => {
      const existingMark = marksMap.get(student.id);
      return {
        id: existingMark?.id,
        exam_paper_id: paperId,
        student_id: student.id,
        admission_number: student.admission_number,
        full_name: student.full_name,
        marks: existingMark?.marks ?? null,
        grade: existingMark?.grade ?? null,
        points: existingMark?.points ?? null,
        is_absent: existingMark?.is_absent || false,
        remarks: existingMark?.remarks || null,
        entered_by: existingMark?.entered_by || null,
        is_submitted: existingMark?.is_submitted || false,
        submitted_at: existingMark?.submitted_at || null,
        submitted_by: existingMark?.submitted_by || null,
      };
    });
  },

  async saveMarks(paperId: number, marks: ExamMark[], maxMarks: number): Promise<void> {
    // Get current user
    const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id).single();

    const marksToSave = marks
      .filter(m => m.marks !== null || m.is_absent)
      .map(m => {
        const gradeInfo = m.marks !== null ? calculateCBCGrade(m.marks, maxMarks) : { grade: null, points: null };
        return {
          exam_paper_id: paperId,
          student_id: m.student_id,
          marks: m.marks,
          grade: gradeInfo.grade,
          points: gradeInfo.points,
          is_absent: m.is_absent,
          remarks: m.remarks,
          entered_by: userData?.id,
          is_submitted: false,
        };
      });

    if (marksToSave.length === 0) return;

    const { error } = await supabase
      .from('exam_marks')
      .upsert(marksToSave, { onConflict: 'exam_paper_id,student_id' });

    if (error) throw error;
  },

  async submitMarks(paperId: number): Promise<void> {
    const { data: userData } = await supabase.from('users').select('id').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id).single();

    // Update all marks as submitted
    const { error: marksError } = await supabase
      .from('exam_marks')
      .update({
        is_submitted: true,
        submitted_at: new Date().toISOString(),
        submitted_by: userData?.id,
      })
      .eq('exam_paper_id', paperId)
      .not('marks', 'is', null);

    if (marksError) throw marksError;

    // Update paper status
    const { error: paperError } = await supabase
      .from('exam_papers')
      .update({ status: 'completed' })
      .eq('id', paperId);

    if (paperError) throw paperError;
  },

  // ============ RESULTS & REPORTS ============
  async computeClassResults(sessionId: number, classId: number): Promise<void> {
    // Get all students in the class
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('current_class_id', classId)
      .eq('is_active', true);

    if (!students) return;

    // Compute results for each student using the database function
    for (const student of students) {
      await supabase.rpc('compute_student_results', {
        p_exam_session_id: sessionId,
        p_student_id: student.id,
      });
    }

    // Calculate positions
    await this.calculatePositions(sessionId, classId);
  },

  async calculatePositions(sessionId: number, classId: number): Promise<void> {
    // Get all results for this class
    const { data: results, error } = await supabase
      .from('student_exam_results')
      .select('id, student_id, stream_id, average_points, average_percentage')
      .eq('exam_session_id', sessionId)
      .eq('class_id', classId)
      .order('average_points', { ascending: false })
      .order('average_percentage', { ascending: false });

    if (error) throw error;
    if (!results) return;

    // Calculate class positions
    for (let i = 0; i < results.length; i++) {
      await supabase
        .from('student_exam_results')
        .update({ class_position: i + 1 })
        .eq('id', results[i].id);
    }

    // Calculate stream positions
    const streamGroups = new Map<number, typeof results>();
    results.forEach(r => {
      if (r.stream_id) {
        if (!streamGroups.has(r.stream_id)) {
          streamGroups.set(r.stream_id, []);
        }
        streamGroups.get(r.stream_id)!.push(r);
      }
    });

    for (const [, streamResults] of streamGroups) {
      streamResults.sort((a, b) => {
        if (b.average_points !== a.average_points) return b.average_points - a.average_points;
        return b.average_percentage - a.average_percentage;
      });

      for (let i = 0; i < streamResults.length; i++) {
        await supabase
          .from('student_exam_results')
          .update({ stream_position: i + 1 })
          .eq('id', streamResults[i].id);
      }
    }
  },

  async getClassMeritList(sessionId: number, classId: number, streamId?: number): Promise<ClassMeritListEntry[]> {
    let query = supabase
      .from('student_exam_results')
      .select(`
        *,
        student:students(admission_number, full_name),
        class:classes(name),
        stream:streams(name)
      `)
      .eq('exam_session_id', sessionId)
      .eq('class_id', classId)
      .order('class_position');

    if (streamId) {
      query = query.eq('stream_id', streamId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((r: any) => ({
      position: r.class_position || 0,
      student_id: r.student_id,
      admission_number: r.student?.admission_number || '',
      full_name: r.student?.full_name || '',
      class_name: r.class?.name || '',
      stream_name: r.stream?.name || null,
      total_marks: r.total_marks,
      total_possible: r.total_possible,
      percentage: r.average_percentage,
      average_points: r.average_points,
      overall_grade: r.overall_grade,
      subjects_count: r.subjects_count,
      stream_position: r.stream_position,
    }));
  },

  async getSubjectAnalysis(sessionId: number, classId: number): Promise<SubjectPerformance[]> {
    const { data: papers, error: papersError } = await supabase
      .from('exam_papers')
      .select(`
        id, paper_name, max_marks, subject_id,
        subject:subjects(name, code)
      `)
      .eq('exam_session_id', sessionId)
      .eq('class_id', classId);

    if (papersError) throw papersError;

    const analyses: SubjectPerformance[] = [];

    for (const paper of papers || []) {
      const { data: marks } = await supabase
        .from('exam_marks')
        .select('marks, grade')
        .eq('exam_paper_id', paper.id)
        .not('marks', 'is', null);

      const marksValues = marks?.map(m => Number(m.marks)) || [];
      const gradeDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };

      marks?.forEach(m => {
        if (m.grade && gradeDistribution[m.grade] !== undefined) {
          gradeDistribution[m.grade]++;
        }
      });

      // Get student count
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('current_class_id', classId)
        .eq('is_active', true);

      analyses.push({
        subject_id: paper.subject_id,
        subject_name: (paper.subject as any)?.name || '',
        subject_code: (paper.subject as any)?.code || '',
        paper_name: paper.paper_name,
        total_students: totalStudents || 0,
        marks_entered: marksValues.length,
        class_average: marksValues.length > 0 ? Number((marksValues.reduce((a, b) => a + b, 0) / marksValues.length).toFixed(1)) : 0,
        highest_score: marksValues.length > 0 ? Math.max(...marksValues) : 0,
        lowest_score: marksValues.length > 0 ? Math.min(...marksValues) : 0,
        grade_distribution: gradeDistribution,
      });
    }

    return analyses.sort((a, b) => b.class_average - a.class_average);
  },

  async getStudentReportCard(sessionId: number, studentId: number): Promise<{
    student: any;
    subjects: any[];
    summary: StudentExamResult;
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

    // Get result summary
    const { data: result, error: resultError } = await supabase
      .from('student_exam_results')
      .select('*')
      .eq('exam_session_id', sessionId)
      .eq('student_id', studentId)
      .single();

    if (resultError && resultError.code !== 'PGRST116') throw resultError;

    // Get all marks with subject details
    const { data: marks, error: marksError } = await supabase
      .from('exam_marks')
      .select(`
        marks, grade, points, remarks,
        paper:exam_papers(
          paper_name, max_marks,
          subject:subjects(name, code)
        )
      `)
      .eq('student_id', studentId)
      .eq('paper.exam_session_id', sessionId);

    if (marksError) throw marksError;

    const subjects = (marks || []).map((m: any) => ({
      subject_name: m.paper?.subject?.name || '',
      subject_code: m.paper?.subject?.code || '',
      paper_name: m.paper?.paper_name || '',
      marks: m.marks,
      max_marks: m.paper?.max_marks || 100,
      percentage: m.paper?.max_marks ? Number(((m.marks / m.paper.max_marks) * 100).toFixed(1)) : 0,
      grade: m.grade,
      points: m.points,
      remarks: m.remarks,
    }));

    return {
      student: {
        ...student,
        class_name: (student.class as any)?.name || '',
        stream_name: (student.stream as any)?.name || '',
      },
      subjects,
      summary: result || {
        total_marks: 0,
        total_possible: 0,
        average_percentage: 0,
        total_points: 0,
        average_points: 0,
        overall_grade: 'BE',
        subjects_count: 0,
        class_position: null,
        stream_position: null,
      },
    };
  },

  // ============ EXPORT ============
  async exportMeritList(sessionId: number, classId: number): Promise<Blob> {
    const meritList = await this.getClassMeritList(sessionId, classId);

    const headers = ['Position', 'Admission No.', 'Student Name', 'Class', 'Stream', 'Total', 'Percentage', 'Avg Points', 'Grade', 'Subjects'];
    const rows = meritList.map(entry => [
      entry.position,
      entry.admission_number,
      entry.full_name,
      entry.class_name,
      entry.stream_name || '',
      `${entry.total_marks}/${entry.total_possible}`,
      `${entry.percentage}%`,
      entry.average_points.toFixed(2),
      entry.overall_grade,
      entry.subjects_count,
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  },
};
