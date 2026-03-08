import { supabase } from '@/integrations/supabase/client';

export interface LedgerEntry {
  entry_date: string;
  reference_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  journal_entry_id: number;
  is_reversal: boolean;
}

export interface LedgerFilters {
  accountId: number;
  startDate?: string;
  endDate?: string;
  fiscalYearId?: number;
  fundId?: number;
}

export const ledgerService = {
  async getLedgerStatement(filters: LedgerFilters): Promise<LedgerEntry[]> {
    let query = supabase
      .from('journal_entry_lines')
      .select('debit_amount, credit_amount, description, journal_entries!inner(id, entry_date, reference_number, description, status, is_reversal, fiscal_year_id)')
      .eq('account_id', filters.accountId)
      .eq('journal_entries.status', 'posted')
      .order('journal_entries(entry_date)', { ascending: true });

    if (filters.fundId) {
      query = query.eq('fund_id', filters.fundId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let runningBalance = 0;
    const entries: LedgerEntry[] = [];
    
    // Get account type to determine normal balance
    const { data: account } = await supabase
      .from('chart_of_accounts')
      .select('account_type')
      .eq('id', filters.accountId)
      .single();

    const isDebitNormal = ['asset', 'expense'].includes(account?.account_type || '');

    for (const row of (data || []) as any[]) {
      const je = row.journal_entries;
      
      // Apply date filters
      if (filters.startDate && je.entry_date < filters.startDate) continue;
      if (filters.endDate && je.entry_date > filters.endDate) continue;
      if (filters.fiscalYearId && je.fiscal_year_id !== filters.fiscalYearId) continue;

      const debit = Number(row.debit_amount) || 0;
      const credit = Number(row.credit_amount) || 0;

      if (isDebitNormal) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      entries.push({
        entry_date: je.entry_date,
        reference_number: je.reference_number,
        description: row.description || je.description,
        debit_amount: debit,
        credit_amount: credit,
        running_balance: runningBalance,
        journal_entry_id: je.id,
        is_reversal: je.is_reversal || false,
      });
    }

    return entries;
  },
};
