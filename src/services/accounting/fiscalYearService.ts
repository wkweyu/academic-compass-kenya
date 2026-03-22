import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export interface FiscalYear {
  id: number;
  school_id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  is_current: boolean;
  created_at: string;
}

export const fiscalYearService = {
  async getAll(): Promise<FiscalYear[]> {
    const { data, error } = await supabase
      .from('fiscal_years')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as FiscalYear[];
  },

  async create(fy: Omit<FiscalYear, 'id' | 'created_at' | 'school_id'>): Promise<FiscalYear> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('fiscal_years')
      .insert({ ...fy, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as FiscalYear;
  },

  async lock(id: number): Promise<void> {
    const { error } = await supabase
      .from('fiscal_years')
      .update({ is_locked: true })
      .eq('id', id);
    if (error) throw error;
  },

  async setCurrent(id: number): Promise<void> {
    const schoolId = await getSchoolId();
    // Unset all current
    await supabase.from('fiscal_years').update({ is_current: false }).eq('school_id', schoolId);
    const { error } = await supabase.from('fiscal_years').update({ is_current: true }).eq('id', id);
    if (error) throw error;
  },
};
