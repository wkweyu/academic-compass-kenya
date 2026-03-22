import { supabase } from '@/integrations/supabase/client';

export interface FinancialLine {
  account_code: string;
  account_name: string;
  account_type: string;
  amount: number;
}

export interface IncomeExpenditureReport {
  income: FinancialLine[];
  expenditure: FinancialLine[];
  total_income: number;
  total_expenditure: number;
  surplus_deficit: number;
}

export interface FinancialPositionReport {
  assets: FinancialLine[];
  liabilities: FinancialLine[];
  equity: FinancialLine[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

export interface CashFlowLine {
  description: string;
  amount: number;
}

export interface CashFlowReport {
  operating: CashFlowLine[];
  investing: CashFlowLine[];
  financing: CashFlowLine[];
  total_operating: number;
  total_investing: number;
  total_financing: number;
  net_change: number;
  opening_balance: number;
  closing_balance: number;
}

async function getPostedBalances(fiscalYearId?: number, fundId?: number) {
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_code');

  let query = supabase
    .from('journal_entry_lines')
    .select('account_id, debit_amount, credit_amount, journal_entries!inner(status, fiscal_year_id)')
    .eq('journal_entries.status', 'posted');

  if (fiscalYearId) {
    query = query.eq('journal_entries.fiscal_year_id', fiscalYearId);
  }
  if (fundId) {
    query = query.eq('fund_id', fundId);
  }

  const { data: lines } = await query;

  const balanceMap = new Map<number, number>();
  for (const line of (lines || []) as any[]) {
    const existing = balanceMap.get(line.account_id) || 0;
    const debit = Number(line.debit_amount) || 0;
    const credit = Number(line.credit_amount) || 0;
    balanceMap.set(line.account_id, existing + debit - credit);
  }

  return { accounts: accounts || [], balanceMap };
}

export const reportService = {
  async getIncomeExpenditure(fiscalYearId?: number, fundId?: number): Promise<IncomeExpenditureReport> {
    const { accounts, balanceMap } = await getPostedBalances(fiscalYearId, fundId);

    const income: FinancialLine[] = [];
    const expenditure: FinancialLine[] = [];

    for (const a of accounts as any[]) {
      const netBalance = balanceMap.get(a.id) || 0;
      if (netBalance === 0) continue;

      const line: FinancialLine = {
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        amount: Math.abs(netBalance),
      };

      if (a.account_type === 'income') {
        income.push(line);
      } else if (a.account_type === 'expense') {
        expenditure.push(line);
      }
    }

    const total_income = income.reduce((s, l) => s + l.amount, 0);
    const total_expenditure = expenditure.reduce((s, l) => s + l.amount, 0);

    return {
      income,
      expenditure,
      total_income,
      total_expenditure,
      surplus_deficit: total_income - total_expenditure,
    };
  },

  async getFinancialPosition(fiscalYearId?: number, fundId?: number): Promise<FinancialPositionReport> {
    const { accounts, balanceMap } = await getPostedBalances(fiscalYearId, fundId);

    const assets: FinancialLine[] = [];
    const liabilities: FinancialLine[] = [];
    const equity: FinancialLine[] = [];

    for (const a of accounts as any[]) {
      const netBalance = balanceMap.get(a.id) || 0;
      if (netBalance === 0) continue;

      const line: FinancialLine = {
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        amount: Math.abs(netBalance),
      };

      if (a.account_type === 'asset') assets.push(line);
      else if (a.account_type === 'liability') liabilities.push(line);
      else if (a.account_type === 'equity') equity.push(line);
    }

    // Add surplus/deficit from income/expense to equity
    const ie = await this.getIncomeExpenditure(fiscalYearId, fundId);
    if (ie.surplus_deficit !== 0) {
      equity.push({
        account_code: '',
        account_name: ie.surplus_deficit >= 0 ? 'Surplus for the Period' : 'Deficit for the Period',
        account_type: 'equity',
        amount: Math.abs(ie.surplus_deficit),
      });
    }

    const total_assets = assets.reduce((s, l) => s + l.amount, 0);
    const total_liabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const total_equity = equity.reduce((s, l) => s + l.amount, 0);

    return { assets, liabilities, equity, total_assets, total_liabilities, total_equity };
  },

  async getCashFlowStatement(fiscalYearId?: number): Promise<CashFlowReport> {
    // Get cash/bank account movements
    const { data: cashAccounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name')
      .eq('is_active', true)
      .eq('account_type', 'asset')
      .or('account_code.like.1000%,account_code.like.1100%');

    const cashAccountIds = (cashAccounts || []).map((a: any) => a.id);
    if (cashAccountIds.length === 0) {
      return { operating: [], investing: [], financing: [], total_operating: 0, total_investing: 0, total_financing: 0, net_change: 0, opening_balance: 0, closing_balance: 0 };
    }

    let query = supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount, description, journal_entries!inner(status, fiscal_year_id, description)')
      .eq('journal_entries.status', 'posted')
      .in('account_id', cashAccountIds);

    if (fiscalYearId) {
      query = query.eq('journal_entries.fiscal_year_id', fiscalYearId);
    }

    const { data: lines } = await query;

    const operating: CashFlowLine[] = [];
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const line of (lines || []) as any[]) {
      const debit = Number(line.debit_amount) || 0;
      const credit = Number(line.credit_amount) || 0;
      const net = debit - credit;
      const desc = line.description || (line.journal_entries as any)?.description || 'Transaction';
      operating.push({ description: desc, amount: net });
      if (net > 0) totalInflow += net;
      else totalOutflow += net;
    }

    const netChange = totalInflow + totalOutflow;

    return {
      operating,
      investing: [],
      financing: [],
      total_operating: netChange,
      total_investing: 0,
      total_financing: 0,
      net_change: netChange,
      opening_balance: 0,
      closing_balance: netChange,
    };
  },

  async getTrialBalance(fiscalYearId?: number, fundId?: number) {
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('is_active', true)
      .order('account_code');

    let query = supabase
      .from('journal_entry_lines')
      .select('account_id, debit_amount, credit_amount, journal_entries!inner(status, fiscal_year_id)')
      .eq('journal_entries.status', 'posted');

    if (fiscalYearId) query = query.eq('journal_entries.fiscal_year_id', fiscalYearId);
    if (fundId) query = query.eq('fund_id', fundId);

    const { data: lines } = await query;

    const accountMap = new Map<number, { debit: number; credit: number }>();
    for (const l of (lines || []) as any[]) {
      const existing = accountMap.get(l.account_id) || { debit: 0, credit: 0 };
      existing.debit += Number(l.debit_amount) || 0;
      existing.credit += Number(l.credit_amount) || 0;
      accountMap.set(l.account_id, existing);
    }

    return (accounts || []).map((a: any) => ({
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      debit_total: accountMap.get(a.id)?.debit || 0,
      credit_total: accountMap.get(a.id)?.credit || 0,
    })).filter((a: any) => a.debit_total > 0 || a.credit_total > 0);
  },

  async getAuditLog(filters?: { startDate?: string; endDate?: string }) {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('module', 'accounting')
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
};
