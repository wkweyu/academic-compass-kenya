import { supabase } from "@/integrations/supabase/client";
import { ClassSubject, SubjectGroup, StudentSubjectAllocation, ClassSubjectFormData, SubjectGroupFormData } from "@/types/class-subject";

export const classSubjectService = {
  // ==================== CLASS SUBJECTS ====================
  
  async getClassSubjects(classId?: number): Promise<ClassSubject[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    let query = supabase
      .from('class_subjects')
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core),
        teacher:teachers(id, first_name, last_name, employee_no),
        subject_group:subject_groups(id, name, min_subjects, max_subjects)
      `)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true });

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      class: item.class,
      subject: item.subject,
      teacher: item.teacher,
      subject_group: item.subject_group
    })) as ClassSubject[];
  },

  async addSubjectToClass(classId: number, data: ClassSubjectFormData): Promise<ClassSubject> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    const { data: result, error } = await supabase
      .from('class_subjects')
      .insert({
        class_id: classId,
        subject_id: data.subject_id,
        teacher_id: data.teacher_id || null,
        school_id: schoolId,
        is_examinable: data.is_examinable,
        is_compulsory: data.is_compulsory,
        periods_per_week: data.periods_per_week || 3,
        subject_group_id: data.subject_group_id || null,
        is_active: true
      })
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core),
        teacher:teachers(id, first_name, last_name, employee_no)
      `)
      .single();

    if (error) throw error;
    return result as ClassSubject;
  },

  async updateClassSubject(id: number, data: Partial<ClassSubjectFormData>): Promise<ClassSubject> {
    const updateData: any = {};
    if (data.teacher_id !== undefined) updateData.teacher_id = data.teacher_id;
    if (data.is_examinable !== undefined) updateData.is_examinable = data.is_examinable;
    if (data.is_compulsory !== undefined) updateData.is_compulsory = data.is_compulsory;
    if (data.periods_per_week !== undefined) updateData.periods_per_week = data.periods_per_week;
    if (data.subject_group_id !== undefined) updateData.subject_group_id = data.subject_group_id;

    const { data: result, error } = await supabase
      .from('class_subjects')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        class:classes(id, name, grade_level),
        subject:subjects(id, name, code, is_core),
        teacher:teachers(id, first_name, last_name, employee_no)
      `)
      .single();

    if (error) throw error;
    return result as ClassSubject;
  },

  async removeSubjectFromClass(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('class_subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Get only examinable subjects for a class (for exam module)
  async getExaminableSubjects(classId: number): Promise<ClassSubject[]> {
    const subjects = await this.getClassSubjects(classId);
    return subjects.filter(s => s.is_examinable && s.is_active);
  },

  // ==================== SUBJECT GROUPS ====================
  
  async getSubjectGroups(classId?: number): Promise<SubjectGroup[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    let query = supabase
      .from('subject_groups')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as SubjectGroup[];
  },

  async createSubjectGroup(classId: number, data: SubjectGroupFormData): Promise<SubjectGroup> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    const { data: result, error } = await supabase
      .from('subject_groups')
      .insert({
        name: data.name,
        description: data.description || '',
        class_id: classId,
        school_id: schoolId,
        min_subjects: data.min_subjects,
        max_subjects: data.max_subjects,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return result as SubjectGroup;
  },

  async updateSubjectGroup(id: number, data: Partial<SubjectGroupFormData>): Promise<SubjectGroup> {
    const { data: result, error } = await supabase
      .from('subject_groups')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result as SubjectGroup;
  },

  async deleteSubjectGroup(id: number): Promise<boolean> {
    // First, unlink any subjects from this group
    await supabase
      .from('class_subjects')
      .update({ subject_group_id: null })
      .eq('subject_group_id', id);

    const { error } = await supabase
      .from('subject_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // ==================== STUDENT SUBJECT ALLOCATIONS ====================
  
  async getStudentSubjectAllocations(classSubjectId?: number, studentId?: number): Promise<StudentSubjectAllocation[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    let query = supabase
      .from('student_subject_allocations')
      .select(`
        *,
        student:students(id, full_name, admission_number),
        class_subject:class_subjects(
          id, 
          subject:subjects(id, name, code),
          class:classes(id, name)
        )
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (classSubjectId) {
      query = query.eq('class_subject_id', classSubjectId);
    }
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data as StudentSubjectAllocation[];
  },

  async allocateStudentsToSubject(classSubjectId: number, studentIds: number[], academicYear: number, term: number): Promise<StudentSubjectAllocation[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    const allocations = studentIds.map(studentId => ({
      student_id: studentId,
      class_subject_id: classSubjectId,
      school_id: schoolId,
      academic_year: academicYear,
      term: term,
      is_active: true
    }));

    const { data, error } = await supabase
      .from('student_subject_allocations')
      .upsert(allocations, { onConflict: 'student_id,class_subject_id,academic_year,term' })
      .select();

    if (error) throw error;
    return data as StudentSubjectAllocation[];
  },

  async removeStudentFromSubject(allocationId: number): Promise<boolean> {
    const { error } = await supabase
      .from('student_subject_allocations')
      .delete()
      .eq('id', allocationId);

    if (error) throw error;
    return true;
  },

  // Auto-allocate all students in a class to compulsory subjects
  async autoAllocateCompulsorySubjects(classId: number, academicYear: number, term: number): Promise<void> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) throw new Error('No school found');

    // Get all compulsory subjects for this class
    const compulsorySubjects = await this.getClassSubjects(classId);
    const compulsory = compulsorySubjects.filter(s => s.is_compulsory && s.is_active);

    if (compulsory.length === 0) return;

    // Get all students in this class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('current_class_id', classId)
      .eq('school_id', schoolId)
      .eq('is_active', true);

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) return;

    // Allocate each student to each compulsory subject
    for (const subject of compulsory) {
      await this.allocateStudentsToSubject(
        subject.id, 
        students.map(s => s.id), 
        academicYear, 
        term
      );
    }
  },

  // Get students allocated to a specific class subject
  async getStudentsForSubject(classSubjectId: number): Promise<any[]> {
    const allocations = await this.getStudentSubjectAllocations(classSubjectId);
    return allocations.map(a => a.student).filter(Boolean);
  },

  // Get subjects a specific student is enrolled in
  async getSubjectsForStudent(studentId: number, academicYear?: number): Promise<ClassSubject[]> {
    const { data: schoolId } = await supabase.rpc('get_user_school_id');
    if (!schoolId) return [];

    let query = supabase
      .from('student_subject_allocations')
      .select(`
        class_subject:class_subjects(
          *,
          subject:subjects(id, name, code, is_core),
          teacher:teachers(id, first_name, last_name)
        )
      `)
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (academicYear) {
      query = query.eq('academic_year', academicYear);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((d: any) => d.class_subject).filter(Boolean) as ClassSubject[];
  }
};
