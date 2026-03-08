import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export interface ChartOfAccount {
  id: number;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  parent_id?: number;
  parent_name?: string;
  is_active: boolean;
  description?: string;
  school_id: number;
}

export interface JournalEntry {
  id: number;
  entry_date: string;
  reference_number: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'posted' | 'voided';
  posted_by?: number;
  posted_at?: string;
  school_id: number;
  created_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  account_name?: string;
  account_code?: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
}

export const accountingService = {
  // Chart of Accounts
  async getAccounts(): Promise<ChartOfAccount[]> {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .order('account_code');
    if (error) throw error;
    return (data || []) as unknown as ChartOfAccount[];
  },

  async createAccount(account: Omit<ChartOfAccount, 'id'>): Promise<ChartOfAccount> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .insert({ ...account, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as ChartOfAccount;
  },

  async updateAccount(id: number, updates: Partial<ChartOfAccount>): Promise<void> {
    const { error } = await supabase.from('chart_of_accounts').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteAccount(id: number): Promise<void> {
    const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id);
    if (error) throw error;
  },

  // Journal Entries
  async getJournalEntries(filters?: { status?: string }): Promise<JournalEntry[]> {
    let query = supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as unknown as JournalEntry[];
  },

  async getJournalEntry(id: number): Promise<JournalEntry> {
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries').select('*').eq('id', id).single();
    if (entryError) throw entryError;

    const { data: lines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select('*, chart_of_accounts(account_name, account_code)')
      .eq('journal_entry_id', id);
    if (linesError) throw linesError;

    return {
      ...(entry as any),
      lines: (lines || []).map((l: any) => ({
        ...l,
        account_name: l.chart_of_accounts?.account_name,
        account_code: l.chart_of_accounts?.account_code,
      })),
    };
  },

  async createJournalEntry(
    entry: Omit<JournalEntry, 'id' | 'created_at' | 'lines'>,
    lines: Omit<JournalEntryLine, 'id' | 'journal_entry_id' | 'account_name' | 'account_code'>[]
  ): Promise<JournalEntry> {
    const schoolId = await getSchoolId();
    
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit_amount), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit_amount), 0);

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        ...entry,
        school_id: schoolId,
        total_debit: totalDebit,
        total_credit: totalCredit,
      })
      .select().single();
    if (error) throw error;

    const entryLines = lines.map(l => ({
      ...l,
      journal_entry_id: (data as any).id,
    }));
    await supabase.from('journal_entry_lines').insert(entryLines);

    return data as unknown as JournalEntry;
  },

  async postJournalEntry(id: number): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .update({ status: 'posted', posted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async voidJournalEntry(id: number): Promise<void> {
    const { error } = await supabase
      .from('journal_entries')
      .update({ status: 'voided', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  // Trial Balance
  async getTrialBalance(): Promise<{ account_code: string; account_name: string; account_type: string; debit_total: number; credit_total: number }[]> {
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('account_code');
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount, journal_entries!inner(status)')
      .eq('journal_entries.status', 'posted');

    const accountMap = new Map<number, { debit: number; credit: number }>();
    (lines || []).forEach((l: any) => {
      const existing = accountMap.get(l.account_id) || { debit: 0, credit: 0 };
      existing.debit += Number(l.debit_amount);
      existing.credit += Number(l.credit_amount);
      accountMap.set(l.account_id, existing);
    });

    return (accounts || []).map((a: any) => ({
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      debit_total: accountMap.get(a.id)?.debit || 0,
      credit_total: accountMap.get(a.id)?.credit || 0,
    })).filter(a => a.debit_total > 0 || a.credit_total > 0);
  },

  // Stats
  async getStats() {
    const [accounts, entries] = await Promise.all([
      supabase.from('chart_of_accounts').select('id, account_type, is_active'),
      supabase.from('journal_entries').select('total_debit, total_credit, status'),
    ]);

    const activeAccounts = (accounts.data || []).filter(a => a.is_active).length;
    const postedEntries = (entries.data || []).filter(e => e.status === 'posted');
    const totalDebits = postedEntries.reduce((s, e) => s + Number(e.total_debit), 0);
    const totalCredits = postedEntries.reduce((s, e) => s + Number(e.total_credit), 0);

    return {
      active_accounts: activeAccounts,
      posted_entries: postedEntries.length,
      draft_entries: (entries.data || []).filter(e => e.status === 'draft').length,
      total_debits: totalDebits,
      total_credits: totalCredits,
    };
  },

  // Seed default chart of accounts
  async seedDefaultAccounts(): Promise<void> {
    const schoolId = await getSchoolId();
    const { data: existing } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('school_id', schoolId)
      .limit(1);
    
    if (existing && existing.length > 0) return; // Already seeded

    const defaults = [
      { account_code: '1000', account_name: 'Cash', account_type: 'asset' },
      { account_code: '1100', account_name: 'Bank Account', account_type: 'asset' },
      { account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset' },
      { account_code: '1300', account_name: 'Inventory', account_type: 'asset' },
      { account_code: '2000', account_name: 'Accounts Payable', account_type: 'liability' },
      { account_code: '2100', account_name: 'PAYE Payable', account_type: 'liability' },
      { account_code: '2200', account_name: 'NHIF Payable', account_type: 'liability' },
      { account_code: '2300', account_name: 'NSSF Payable', account_type: 'liability' },
      { account_code: '2400', account_name: 'Housing Levy Payable', account_type: 'liability' },
      { account_code: '2500', account_name: 'NITA Levy Payable', account_type: 'liability' },
      { account_code: '3000', account_name: 'School Capital', account_type: 'equity' },
      { account_code: '3100', account_name: 'Retained Surplus', account_type: 'equity' },
      { account_code: '4000', account_name: 'Tuition Fees Income', account_type: 'income' },
      { account_code: '4100', account_name: 'Boarding Fees Income', account_type: 'income' },
      { account_code: '4200', account_name: 'Transport Fees Income', account_type: 'income' },
      { account_code: '4300', account_name: 'Other Income', account_type: 'income' },
      { account_code: '5000', account_name: 'Salaries & Wages', account_type: 'expense' },
      { account_code: '5100', account_name: 'Teaching Materials', account_type: 'expense' },
      { account_code: '5200', account_name: 'Utilities', account_type: 'expense' },
      { account_code: '5300', account_name: 'Maintenance & Repairs', account_type: 'expense' },
      { account_code: '5400', account_name: 'Administrative Expenses', account_type: 'expense' },
      { account_code: '5500', account_name: 'Transport Expenses', account_type: 'expense' },
    ];

    await supabase.from('chart_of_accounts').insert(
      defaults.map(d => ({ ...d, school_id: schoolId, is_active: true }))
    );
  },
};
