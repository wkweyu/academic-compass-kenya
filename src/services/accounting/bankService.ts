import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export interface BankAccount {
  id: number;
  school_id: number;
  account_id: number;
  bank_name: string;
  account_number: string;
  branch: string;
  is_active: boolean;
  created_at: string;
  account_name?: string;
  account_code?: string;
}

export interface BankReconciliation {
  id: number;
  school_id: number;
  bank_account_id: number;
  reconciliation_date: string;
  statement_balance: number;
  ledger_balance: number;
  adjusted_balance: number;
  status: 'draft' | 'completed';
  reconciled_by?: string;
  created_at: string;
  items?: BankReconciliationItem[];
}

export interface BankReconciliationItem {
  id: number;
  reconciliation_id: number;
  journal_entry_id?: number;
  description: string;
  amount: number;
  item_type: 'outstanding_check' | 'deposit_in_transit' | 'bank_charge' | 'interest' | 'other';
  is_reconciled: boolean;
  created_at: string;
}

export const bankService = {
  async getBankAccounts(): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*, chart_of_accounts(account_name, account_code)')
      .order('bank_name');
    if (error) throw error;
    return (data || []).map((b: any) => ({
      ...b,
      account_name: b.chart_of_accounts?.account_name,
      account_code: b.chart_of_accounts?.account_code,
    }));
  },

  async createBankAccount(account: Omit<BankAccount, 'id' | 'created_at' | 'school_id' | 'account_name' | 'account_code'>): Promise<BankAccount> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({ ...account, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as BankAccount;
  },

  async getReconciliations(bankAccountId: number): Promise<BankReconciliation[]> {
    const { data, error } = await supabase
      .from('bank_reconciliation_entries')
      .select('*')
      .eq('bank_account_id', bankAccountId)
      .order('reconciliation_date', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as BankReconciliation[];
  },

  async createReconciliation(recon: Omit<BankReconciliation, 'id' | 'created_at' | 'school_id' | 'items'>): Promise<BankReconciliation> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('bank_reconciliation_entries')
      .insert({ ...recon, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as BankReconciliation;
  },

  async addReconciliationItem(item: Omit<BankReconciliationItem, 'id' | 'created_at'>): Promise<void> {
    const { error } = await supabase.from('bank_reconciliation_items').insert(item);
    if (error) throw error;
  },

  async completeReconciliation(id: number): Promise<void> {
    const { error } = await supabase
      .from('bank_reconciliation_entries')
      .update({ status: 'completed' })
      .eq('id', id);
    if (error) throw error;
  },
};
