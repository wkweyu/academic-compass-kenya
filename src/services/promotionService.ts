import { supabase } from "@/integrations/supabase/client";

export interface PromotionData {
  student_id: number;
  from_class_id: number | null;
  to_class_id: number;
  academic_year: number;
  promotion_date?: string;
  notes?: string;
}

export interface BulkPromotionRequest {
  from_class_id: number;
  to_class_id: number;
  academic_year: number;
  promotion_date?: string;
  student_ids?: number[];
  notes?: string;
}

export interface PromotionHistory {
  id: number;
  student_id: number;
  student_name: string;
  from_class_name: string;
  to_class_name: string;
  academic_year: number;
  promotion_date: string;
  notes: string;
}

export const promoteStudent = async (data: PromotionData): Promise<void> => {
  try {
    console.log('Promoting student:', data);
    
    // Get current student info to maintain stream
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('current_stream_id')
      .eq('id', data.student_id)
      .single();

    if (fetchError) {
      console.error('Error fetching student:', fetchError);
      throw fetchError;
    }

    console.log('Student data:', student);

    // Start a transaction by creating the promotion record
    const { error: promotionError } = await supabase
      .from('student_promotions')
      .insert({
        student_id: data.student_id,
        from_class_id: data.from_class_id,
        to_class_id: data.to_class_id,
        academic_year: data.academic_year,
        promotion_date: data.promotion_date || new Date().toISOString(),
        notes: data.notes || ''
      });

    if (promotionError) {
      console.error('Error creating promotion record:', promotionError);
      throw promotionError;
    }

    // Update student's current class while maintaining stream
    const { error: updateError } = await supabase
      .from('students')
      .update({
        current_class_id: data.to_class_id,
        current_stream_id: student?.current_stream_id, // Maintain current stream
        updated_at: new Date().toISOString()
      })
      .eq('id', data.student_id);

    if (updateError) {
      console.error('Error updating student:', updateError);
      throw updateError;
    }
    
    console.log('Student promoted successfully');
  } catch (error) {
    console.error('Error promoting student:', error);
    throw error;
  }
};

export const bulkPromoteStudents = async (data: BulkPromotionRequest): Promise<{
  success: number;
  failed: number;
  errors: Array<{ student_id: number; error: string }>;
}> => {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ student_id: number; error: string }>
  };

  try {
    // Get students to promote (with stream info to maintain it)
    let query = supabase
      .from('students')
      .select('id, full_name, current_class_id, current_stream_id')
      .eq('current_class_id', data.from_class_id)
      .eq('is_active', true);

    if (data.student_ids && data.student_ids.length > 0) {
      query = query.in('id', data.student_ids);
    }

    const { data: students, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!students || students.length === 0) {
      throw new Error('No students found to promote');
    }

    // Promote each student (streams are maintained by promoteStudent)
    for (const student of students) {
      try {
        await promoteStudent({
          student_id: student.id,
          from_class_id: student.current_class_id,
          to_class_id: data.to_class_id,
          academic_year: data.academic_year,
          promotion_date: data.promotion_date,
          notes: data.notes
        });
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          student_id: student.id,
          error: error.message || 'Unknown error'
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Error in bulk promotion:', error);
    throw error;
  }
};

export const getPromotionHistory = async (
  filters?: {
    student_id?: number;
    academic_year?: number;
    from_class_id?: number;
    to_class_id?: number;
  }
): Promise<PromotionHistory[]> => {
  try {
    let query = supabase
      .from('student_promotions')
      .select(`
        id,
        student_id,
        from_class_id,
        to_class_id,
        academic_year,
        promotion_date,
        notes,
        students!student_promotions_student_id_fkey(full_name),
        from_class:classes!student_promotions_from_class_id_fkey(name),
        to_class:classes!student_promotions_to_class_id_fkey(name)
      `)
      .order('promotion_date', { ascending: false });

    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }
    if (filters?.academic_year) {
      query = query.eq('academic_year', filters.academic_year);
    }
    if (filters?.from_class_id) {
      query = query.eq('from_class_id', filters.from_class_id);
    }
    if (filters?.to_class_id) {
      query = query.eq('to_class_id', filters.to_class_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data?.map((item: any) => ({
      id: item.id,
      student_id: item.student_id,
      student_name: item.students?.full_name || 'Unknown',
      from_class_name: item.from_class?.name || 'Unassigned',
      to_class_name: item.to_class?.name || 'Unknown',
      academic_year: item.academic_year,
      promotion_date: item.promotion_date,
      notes: item.notes || ''
    })) || [];
  } catch (error) {
    console.error('Error fetching promotion history:', error);
    throw error;
  }
};

export const transferStudent = async (
  studentId: number,
  toClassId: number,
  toStreamId: number,
  notes?: string
): Promise<void> => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get current class info
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('current_class_id, current_stream_id')
      .eq('id', studentId)
      .single();

    if (fetchError) throw fetchError;

    // Record the transfer as a promotion
    const { error: promotionError } = await supabase
      .from('student_promotions')
      .insert({
        student_id: studentId,
        from_class_id: student?.current_class_id,
        to_class_id: toClassId,
        academic_year: currentYear,
        promotion_date: new Date().toISOString(),
        notes: notes || 'Class transfer'
      });

    if (promotionError) throw promotionError;

    // Update student's class and stream
    const { error: updateError } = await supabase
      .from('students')
      .update({
        current_class_id: toClassId,
        current_stream_id: toStreamId,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error transferring student:', error);
    throw error;
  }
};
