import { supabase } from "@/integrations/supabase/client";
import { Student } from '@/types/student';
import { Score } from '@/types/score';
import { Exam } from '@/types/exam';

export const scoreService = {
  async getExams(): Promise<Exam[]> {
    try {
      const { data, error } = await supabase
        .from('exams_exam')
        .select(`
          *,
          subject:subjects(name, code),
          class:classes(name),
          stream:streams(name),
          exam_type:exams_examtype(name)
        `)
        .order('exam_date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((exam: any) => ({
        id: exam.id,
        name: exam.name,
        subject_id: exam.subject_id,
        subject_name: exam.subject?.name || '',
        subject: exam.subject?.name || '',
        subject_code: exam.subject?.code || '',
        class_id: exam.class_assigned_id,
        class_name: exam.class?.name,
        class_assigned: exam.class?.name,
        stream_id: exam.stream_id,
        stream_name: exam.stream?.name,
        stream: exam.stream?.name,
        exam_type: exam.exam_type?.name || '',
        date: exam.exam_date,
        exam_date: exam.exam_date,
        duration: exam.duration_minutes,
        duration_minutes: exam.duration_minutes,
        max_marks: exam.max_marks,
        instructions: exam.instructions,
        is_published: exam.is_published,
        term: exam.term_id,
        academic_year: exam.academic_year,
        created_at: exam.created_at,
        updated_at: exam.updated_at,
      }));
    } catch (error) {
      console.error('Error fetching exams:', error);
      return [];
    }
  },

  async getStudentsForExam(examId: number): Promise<Student[]> {
    try {
      const { data: exam, error: examError } = await supabase
        .from('exams_exam')
        .select('class_assigned_id, stream_id')
        .eq('id', examId)
        .single();
      
      if (examError) throw examError;
      
      let query = supabase
        .from('students')
        .select('*')
        .eq('current_class_id', exam.class_assigned_id)
        .eq('is_active', true);
      
      if (exam.stream_id) {
        query = query.eq('current_stream_id', exam.stream_id);
      }
      
      const { data, error } = await query.order('full_name');
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching students for exam:', error);
      return [];
    }
  },

  async getScores(examId: number): Promise<Score[]> {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          student:students(full_name)
        `)
        .eq('exam_id', examId);
      
      if (error) throw error;
      
      return (data || []).map((score: any) => ({
        id: score.id,
        student_id: score.student_id,
        student_name: score.student?.full_name,
        exam_id: score.exam_id,
        marks_obtained: score.marks,
        marks: score.marks,
        grade: score.grade,
        remarks: score.remarks,
        created_at: score.created_at,
        updated_at: score.updated_at,
      }));
    } catch (error) {
      console.error('Error fetching scores:', error);
      return [];
    }
  },

  async saveScores(scores: Score[]): Promise<void> {
    try {
      const insertScores = scores.map(score => ({
        exam_id: score.exam_id,
        student_id: score.student_id,
        marks: score.marks || score.marks_obtained,
        grade: score.grade,
        remarks: score.remarks || '',
        is_absent: false,
      }));
      
      const { error } = await supabase
        .from('scores')
        .upsert(insertScores, {
          onConflict: 'exam_id,student_id'
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error saving scores:', error);
      throw error;
    }
  },

  async exportScores(examId: number): Promise<Blob> {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          student:students(full_name, admission_number),
          exam:exams_exam(name, max_marks)
        `)
        .eq('exam_id', examId);
      
      if (error) throw error;
      
      const headers = ['Admission Number', 'Student Name', 'Marks', 'Grade', 'Remarks'];
      const rows = (data || []).map((score: any) => [
        score.student?.admission_number || '',
        score.student?.full_name || '',
        score.marks,
        score.grade,
        score.remarks || ''
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      return new Blob([csv], { type: 'text/csv' });
    } catch (error) {
      console.error('Error exporting scores:', error);
      throw error;
    }
  }
};