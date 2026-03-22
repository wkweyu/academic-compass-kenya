import { supabase } from "@/integrations/supabase/client";
import { Exam, ExamFilters } from "@/types/exam";

export const examService = {
  async getExams(filters?: ExamFilters): Promise<Exam[]> {
    try {
      let query = supabase
        .from('exams_exam')
        .select(`
          *,
          subject:subjects(name, code),
          class:classes(name),
          stream:streams(name),
          exam_type:exams_examtype(name)
        `);
      
      if (filters?.class_id) {
        query = query.eq('class_assigned_id', filters.class_id);
      }
      
      if (filters?.subject_id) {
        query = query.eq('subject_id', filters.subject_id);
      }
      
      if (filters?.is_published !== undefined) {
        query = query.eq('is_published', filters.is_published);
      }
      
      if (filters?.term) {
        query = query.eq('term_id', filters.term);
      }
      
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }
      
      const { data, error } = await query.order('exam_date', { ascending: false });
      
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
};
