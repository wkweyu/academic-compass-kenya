import { supabase } from "@/integrations/supabase/client";
import { Subject, SubjectCategory, ClassSubject, SubjectFilters, SubjectStats, SubjectDependencies } from '@/types/subject';

export const subjectService = {
  // =============================================
  // SUBJECT CATEGORIES
  // =============================================
  
  async getCategories(): Promise<SubjectCategory[]> {
    try {
      const { data, error } = await supabase
        .from('subject_categories')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return (data || []) as SubjectCategory[];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  },

  async createCategory(data: Omit<SubjectCategory, 'id' | 'created_at' | 'updated_at'>): Promise<SubjectCategory> {
    const { data: newCategory, error } = await supabase
      .from('subject_categories')
      .insert([data])
      .select()
      .single();
    
    if (error) throw error;
    return newCategory as SubjectCategory;
  },

  async updateCategory(id: number, data: Partial<SubjectCategory>): Promise<SubjectCategory> {
    const { data: updated, error } = await supabase
      .from('subject_categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return updated as SubjectCategory;
  },

  async deleteCategory(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('subject_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // =============================================
  // SUBJECTS
  // =============================================

  async getSubjects(filters?: SubjectFilters): Promise<Subject[]> {
    try {
      let query = supabase.from('subjects').select(`
        *,
        category:subject_categories(id, name)
      `);
      
      if (filters?.is_core !== undefined) {
        query = query.eq('is_core', filters.is_core);
      }
      
      if (filters?.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active);
      }
      
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }
      
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      
      const subjects = await Promise.all((data || []).map(async (subject: any) => {
        // Get stats for each subject
        const stats = await this.getSubjectDependencies(subject.id);
        
        return {
          ...subject,
          grade_levels: subject.grade_levels ? JSON.parse(subject.grade_levels) : [],
          assigned_classes: stats.class_count,
          assigned_teachers: stats.teacher_count,
          total_exams: stats.exam_count
        };
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
        .select(`
          *,
          category:subject_categories(id, name, description)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      const stats = await this.getSubjectDependencies(id);
      
      return {
        ...data,
        grade_levels: data.grade_levels ? JSON.parse(data.grade_levels) : [],
        assigned_classes: stats.class_count,
        assigned_teachers: stats.teacher_count,
        total_exams: stats.exam_count
      } as Subject;
    } catch (error) {
      console.error('Error fetching subject:', error);
      return null;
    }
  },

  async createSubject(data: Omit<Subject, 'id' | 'created_at' | 'updated_at' | 'category'>): Promise<Subject> {
    // Get user's school_id
    const { data: userData } = await supabase.rpc('get_user_school_id');
    
    const insertData = {
      name: data.name,
      code: data.code,
      description: data.description || '',
      is_core: data.is_core,
      is_active: data.is_active ?? true,
      category_id: data.category_id,
      school_id: userData,
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
    } as Subject;
  },

  async updateSubject(id: number, data: Partial<Subject>): Promise<Subject | null> {
    const updateData: any = { ...data };
    delete updateData.category;
    delete updateData.assigned_classes;
    delete updateData.assigned_teachers;
    delete updateData.total_exams;
    
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
    } as Subject;
  },

  async deleteSubject(id: number): Promise<boolean> {
    // Check dependencies first
    const deps = await this.getSubjectDependencies(id);
    if (deps.has_dependencies) {
      throw new Error(`Cannot delete subject. It has ${deps.class_count} class allocations, ${deps.teacher_count} teacher assignments, and ${deps.exam_count} exams.`);
    }
    
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async deactivateSubject(id: number): Promise<Subject | null> {
    return this.updateSubject(id, { is_active: false });
  },

  async activateSubject(id: number): Promise<Subject | null> {
    return this.updateSubject(id, { is_active: true });
  },

  async getSubjectDependencies(id: number): Promise<SubjectDependencies> {
    try {
      const { data, error } = await supabase.rpc('check_subject_dependencies', {
        p_subject_id: id
      });
      
      if (error) throw error;
      
      return data?.[0] || {
        has_dependencies: false,
        class_count: 0,
        teacher_count: 0,
        exam_count: 0
      };
    } catch (error) {
      console.error('Error checking dependencies:', error);
      return {
        has_dependencies: false,
        class_count: 0,
        teacher_count: 0,
        exam_count: 0
      };
    }
  },

  async getSubjectStats(): Promise<SubjectStats> {
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select(`
          *,
          category:subject_categories(name)
        `);
      
      if (error) throw error;
      
      const subjects = (data || []).map(subject => ({
        ...subject,
        grade_levels: subject.grade_levels ? JSON.parse(subject.grade_levels) : []
      }));
      
      const activeSubjects = subjects.filter(s => s.is_active);
      const inactiveSubjects = subjects.filter(s => !s.is_active);
      const coreSubjects = subjects.filter(s => s.is_core);
      const electiveSubjects = subjects.filter(s => !s.is_core);
      
      const subjects_by_grade: { [grade: string]: number } = {};
      subjects.forEach(subject => {
        subject.grade_levels.forEach((grade: number) => {
          const gradeKey = `Grade ${grade}`;
          subjects_by_grade[gradeKey] = (subjects_by_grade[gradeKey] || 0) + 1;
        });
      });
      
      const subjects_by_category: { [category: string]: number } = {};
      subjects.forEach((subject: any) => {
        const categoryName = subject.category?.name || 'Uncategorized';
        subjects_by_category[categoryName] = (subjects_by_category[categoryName] || 0) + 1;
      });
      
      return {
        total_subjects: subjects.length,
        active_subjects: activeSubjects.length,
        inactive_subjects: inactiveSubjects.length,
        core_subjects: coreSubjects.length,
        elective_subjects: electiveSubjects.length,
        subjects_by_grade,
        subjects_by_category
      };
    } catch (error) {
      console.error('Error fetching subject stats:', error);
      return {
        total_subjects: 0,
        active_subjects: 0,
        inactive_subjects: 0,
        core_subjects: 0,
        elective_subjects: 0,
        subjects_by_grade: {},
        subjects_by_category: {}
      };
    }
  },

  // =============================================
  // CLASS-SUBJECT ALLOCATIONS
  // =============================================

  async getClassSubjects(classId?: number, subjectId?: number): Promise<ClassSubject[]> {
    try {
      let query = supabase.from('class_subjects').select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core, is_active),
        teacher:teachers(id, first_name, last_name, employee_no)
      `);
      
      if (classId) {
        query = query.eq('class_id', classId);
      }
      
      if (subjectId) {
        query = query.eq('subject_id', subjectId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ClassSubject[];
    } catch (error) {
      console.error('Error fetching class subjects:', error);
      return [];
    }
  },

  async allocateSubjectToClass(data: {
    class_id: number;
    subject_id: number;
    teacher_id?: number | null;
    periods_per_week?: number;
  }): Promise<ClassSubject> {
    // Get user's school_id
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    // Check if subject is active
    const subject = await this.getSubject(data.subject_id);
    if (subject && !subject.is_active) {
      throw new Error('Cannot assign inactive subject to a class');
    }
    
    const insertData = {
      class_id: data.class_id,
      subject_id: data.subject_id,
      teacher_id: data.teacher_id || null,
      school_id: schoolId,
      periods_per_week: data.periods_per_week || 3,
      is_active: true
    };
    
    const { data: allocation, error } = await supabase
      .from('class_subjects')
      .insert([insertData])
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core, is_active),
        teacher:teachers(id, first_name, last_name, employee_no)
      `)
      .single();
    
    if (error) {
      if (error.code === '23505') {
        throw new Error('This subject is already allocated to this class');
      }
      throw error;
    }
    
    return allocation as ClassSubject;
  },

  async updateClassSubject(id: number, data: Partial<ClassSubject>): Promise<ClassSubject> {
    const { data: updated, error } = await supabase
      .from('class_subjects')
      .update({
        teacher_id: data.teacher_id,
        periods_per_week: data.periods_per_week,
        is_active: data.is_active
      })
      .eq('id', id)
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core, is_active),
        teacher:teachers(id, first_name, last_name, employee_no)
      `)
      .single();
    
    if (error) throw error;
    return updated as ClassSubject;
  },

  async removeSubjectFromClass(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('class_subjects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async bulkAllocateSubjectsToClass(classId: number, subjectIds: number[]): Promise<ClassSubject[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    
    const insertData = subjectIds.map(subjectId => ({
      class_id: classId,
      subject_id: subjectId,
      school_id: schoolId,
      is_active: true,
      periods_per_week: 3
    }));
    
    const { data, error } = await supabase
      .from('class_subjects')
      .upsert(insertData, { onConflict: 'class_id,subject_id' })
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core, is_active),
        teacher:teachers(id, first_name, last_name, employee_no)
      `);
    
    if (error) throw error;
    return (data || []) as ClassSubject[];
  },

  // =============================================
  // TEACHER-SUBJECT INTEGRATION
  // =============================================

  async getTeachersForSubject(subjectId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('teacher_specializations')
        .select(`
          *,
          teacher:teachers(id, first_name, last_name, employee_no, email, phone, is_active)
        `)
        .eq('subject_id', subjectId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching teachers for subject:', error);
      return [];
    }
  },

  async getSubjectsForTeacher(teacherId: number): Promise<Subject[]> {
    try {
      const { data, error } = await supabase
        .from('teacher_specializations')
        .select(`
          subject:subjects(*)
        `)
        .eq('teacher_id', teacherId);
      
      if (error) throw error;
      
      return (data || [])
        .map((d: any) => d.subject)
        .filter(Boolean)
        .map((subject: any) => ({
          ...subject,
          grade_levels: subject.grade_levels ? JSON.parse(subject.grade_levels) : []
        }));
    } catch (error) {
      console.error('Error fetching subjects for teacher:', error);
      return [];
    }
  },

  // =============================================
  // UTILITY FUNCTIONS
  // =============================================

  async checkNameCodeUnique(name: string, code: string, excludeId?: number): Promise<{ nameExists: boolean; codeExists: boolean }> {
    try {
      let nameQuery = supabase.from('subjects').select('id').ilike('name', name);
      let codeQuery = supabase.from('subjects').select('id').ilike('code', code);
      
      if (excludeId) {
        nameQuery = nameQuery.neq('id', excludeId);
        codeQuery = codeQuery.neq('id', excludeId);
      }
      
      const [nameResult, codeResult] = await Promise.all([
        nameQuery,
        codeQuery
      ]);
      
      return {
        nameExists: (nameResult.data?.length || 0) > 0,
        codeExists: (codeResult.data?.length || 0) > 0
      };
    } catch (error) {
      console.error('Error checking uniqueness:', error);
      return { nameExists: false, codeExists: false };
    }
  }
};
