import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export interface AccountingFund {
  id: number;
  school_id: number;
  fund_code: string;
  fund_name: string;
  fund_type: 'tuition' | 'government_grant' | 'infrastructure' | 'feeding' | 'capitation' | 'other';
  description?: string;
  is_restricted: boolean;
  is_active: boolean;
  created_at: string;
}

export const fundService = {
  async getAll(): Promise<AccountingFund[]> {
    const { data, error } = await supabase
      .from('accounting_funds')
      .select('*')
      .order('fund_code');
    if (error) throw error;
    return (data || []) as unknown as AccountingFund[];
  },

  async create(fund: Omit<AccountingFund, 'id' | 'created_at' | 'school_id'>): Promise<AccountingFund> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('accounting_funds')
      .insert({ ...fund, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AccountingFund;
  },

  async update(id: number, updates: Partial<AccountingFund>): Promise<void> {
    const { error } = await supabase.from('accounting_funds').update(updates).eq('id', id);
    if (error) throw error;
  },

  async seedDefaults(): Promise<void> {
    const schoolId = await getSchoolId();
    const { data: existing } = await supabase
      .from('accounting_funds')
      .select('id')
      .eq('school_id', schoolId)
      .limit(1);
    if (existing && existing.length > 0) return;

    const defaults = [
      { fund_code: 'TF', fund_name: 'Tuition Fund', fund_type: 'tuition', is_restricted: false, description: 'Student fee payments' },
      { fund_code: 'GG', fund_name: 'Government Grant Fund', fund_type: 'government_grant', is_restricted: true, description: 'Government subsidies and grants' },
      { fund_code: 'IF', fund_name: 'Infrastructure Fund', fund_type: 'infrastructure', is_restricted: true, description: 'Buildings and equipment' },
      { fund_code: 'FP', fund_name: 'Feeding Program', fund_type: 'feeding', is_restricted: true, description: 'School meals program' },
      { fund_code: 'CF', fund_name: 'Capitation Fund', fund_type: 'capitation', is_restricted: true, description: 'Government capitation grants' },
    ];

    await supabase.from('accounting_funds').insert(
      defaults.map(d => ({ ...d, school_id: schoolId, is_active: true }))
    );
  },
};
