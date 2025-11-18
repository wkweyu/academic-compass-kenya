import { supabase } from "@/integrations/supabase/client";
import { Subject, SubjectFilters, SubjectStats } from '@/types/subject';

export const subjectService = {
  async getSubjects(filters?: SubjectFilters): Promise<Subject[]> {
    try {
      let query = supabase.from('subjects').select('*');
      
      if (filters?.is_core !== undefined) {
        query = query.eq('is_core', filters.is_core);
      }
      
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      const subjects = (data || []).map(subject => ({
        ...subject,
        grade_levels: subject.grade_levels ? JSON.parse(subject.grade_levels) : []
      }));
      
      if (filters?.grade_level) {
        return subjects.filter(s => s.grade_levels.includes(filters.grade_level));
      }
      
      return subjects;
    } catch (error) {
      console.error('Error fetching subjects:', error);
      return [];
    }
  },

  async getSubject(id: number): Promise<Subject | null> {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        grade_levels: data.grade_levels ? JSON.parse(data.grade_levels) : []
      };
    } catch (error) {
      console.error('Error fetching subject:', error);
      return null;
    }
  },

  async createSubject(data: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject> {
    try {
      const insertData = {
        ...data,
        grade_levels: JSON.stringify(data.grade_levels || [])
      };
      
      const { data: newSubject, error } = await supabase
        .from('subjects')
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        ...newSubject,
        grade_levels: newSubject.grade_levels ? JSON.parse(newSubject.grade_levels) : []
      };
    } catch (error) {
      console.error('Error creating subject:', error);
      throw error;
    }
  },

  async updateSubject(id: number, data: Partial<Subject>): Promise<Subject | null> {
    try {
      const updateData: any = { ...data };
      if (data.grade_levels) {
        updateData.grade_levels = JSON.stringify(data.grade_levels);
      }
      
      const { data: updatedSubject, error } = await supabase
        .from('subjects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        ...updatedSubject,
        grade_levels: updatedSubject.grade_levels ? JSON.parse(updatedSubject.grade_levels) : []
      };
    } catch (error) {
      console.error('Error updating subject:', error);
      throw error;
    }
  },

  async deleteSubject(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting subject:', error);
      return false;
    }
  },

  async getSubjectStats(): Promise<SubjectStats> {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*');
      
      if (error) throw error;
      
      const subjects = (data || []).map(subject => ({
        ...subject,
        grade_levels: subject.grade_levels ? JSON.parse(subject.grade_levels) : []
      }));
      
      const coreSubjects = subjects.filter(s => s.is_core);
      const electiveSubjects = subjects.filter(s => !s.is_core);
      
      const subjects_by_grade: { [grade: string]: number } = {};
      subjects.forEach(subject => {
        subject.grade_levels.forEach((grade: number) => {
          const gradeKey = `Grade ${grade}`;
          subjects_by_grade[gradeKey] = (subjects_by_grade[gradeKey] || 0) + 1;
        });
      });
      
      return {
        total_subjects: subjects.length,
        core_subjects: coreSubjects.length,
        elective_subjects: electiveSubjects.length,
        subjects_by_grade,
      };
    } catch (error) {
      console.error('Error fetching subject stats:', error);
      return {
        total_subjects: 0,
        core_subjects: 0,
        elective_subjects: 0,
        subjects_by_grade: {},
      };
    }
  }
};