import { supabase } from '@/integrations/supabase/client';

export interface VoteHead {
  id: number;
  name: string;
  description: string;
  priority: number;
  fee_applicable: boolean;
  student_group: string;
  school_id: number;
}

export interface FeeStructureItem {
  id: number;
  vote_head_id: number;
  vote_head_name?: string;
  amount: number;
  term: number;
  year: number;
  school_id: number;
}

export interface DebitTransaction {
  id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  vote_head_id: number;
  vote_head_name?: string;
  amount: number;
  term: number;
  year: number;
  date: string;
  invoice_number: string;
  remarks: string;
  school_id: number;
}

export interface PaymentTransaction {
  id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  amount: number;
  mode: string;
  transaction_code: string;
  date: string;
  remarks: string;
  apportion_log: any;
  school_id: number;
}

export interface FeeBalanceRecord {
  id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  vote_head_id: number;
  vote_head_name?: string;
  year: number;
  term: number;
  opening_balance: number;
  amount_invoiced: number;
  amount_paid: number;
  closing_balance: number;
  school_id: number;
}

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

export const feesService = {
  // Vote Heads
  async getVoteHeads(): Promise<VoteHead[]> {
    const { data, error } = await supabase
      .from('fees_votehead')
      .select('*')
      .order('priority');
    if (error) throw error;
    return (data || []) as unknown as VoteHead[];
  },

  async createVoteHead(voteHead: Omit<VoteHead, 'id'>): Promise<VoteHead> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('fees_votehead')
      .insert({ ...voteHead, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as VoteHead;
  },

  async updateVoteHead(id: number, updates: Partial<VoteHead>): Promise<VoteHead> {
    const { data, error } = await supabase
      .from('fees_votehead')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as VoteHead;
  },

  async deleteVoteHead(id: number): Promise<void> {
    const { error } = await supabase.from('fees_votehead').delete().eq('id', id);
    if (error) throw error;
  },

  // Fee Structures
  async getFeeStructures(year?: number, term?: number): Promise<FeeStructureItem[]> {
    let query = supabase
      .from('fees_feestructure')
      .select('*, fees_votehead(name)')
      .order('year', { ascending: false });
    if (year) query = query.eq('year', year);
    if (term) query = query.eq('term', term);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      vote_head_name: d.fees_votehead?.name,
    }));
  },

  async createFeeStructure(item: Omit<FeeStructureItem, 'id' | 'vote_head_name'>): Promise<FeeStructureItem> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('fees_feestructure')
      .insert({ ...item, school_id: schoolId })
      .select('*, fees_votehead(name)')
      .single();
    if (error) throw error;
    return { ...(data as any), vote_head_name: (data as any).fees_votehead?.name };
  },

  async updateFeeStructure(id: number, updates: Partial<FeeStructureItem>): Promise<void> {
    const { error } = await supabase.from('fees_feestructure').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteFeeStructure(id: number): Promise<void> {
    const { error } = await supabase.from('fees_feestructure').delete().eq('id', id);
    if (error) throw error;
  },

  // Debit Transactions (Invoices)
  async getDebits(filters?: { year?: number; term?: number; student_id?: number }): Promise<DebitTransaction[]> {
    let query = supabase
      .from('fees_debittransaction')
      .select('*, students(full_name, admission_number, current_class_id, classes(name)), fees_votehead(name)')
      .order('date', { ascending: false });
    if (filters?.year) query = query.eq('year', filters.year);
    if (filters?.term) query = query.eq('term', filters.term);
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name,
      admission_number: d.students?.admission_number,
      class_name: d.students?.classes?.name,
      vote_head_name: d.fees_votehead?.name,
    }));
  },

  async createDebit(debit: Omit<DebitTransaction, 'id' | 'student_name' | 'admission_number' | 'class_name' | 'vote_head_name'>): Promise<DebitTransaction> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('fees_debittransaction')
      .insert({ ...debit, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as DebitTransaction;
  },

  // Payment Transactions
  async getPayments(filters?: { student_id?: number; mode?: string }): Promise<PaymentTransaction[]> {
    let query = supabase
      .from('fees_paymenttransaction')
      .select('*, students(full_name, admission_number)')
      .order('date', { ascending: false });
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    if (filters?.mode) query = query.eq('mode', filters.mode);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name,
      admission_number: d.students?.admission_number,
    }));
  },

  async createPayment(payment: Omit<PaymentTransaction, 'id' | 'student_name' | 'admission_number'>): Promise<PaymentTransaction> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('fees_paymenttransaction')
      .insert({ ...payment, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as PaymentTransaction;
  },

  // Fee Balances
  async getFeeBalances(filters?: { year?: number; term?: number }): Promise<FeeBalanceRecord[]> {
    let query = supabase
      .from('fees_feebalance')
      .select('*, students(full_name, admission_number, current_class_id, classes(name)), fees_votehead(name)')
      .order('student_id');
    if (filters?.year) query = query.eq('year', filters.year);
    if (filters?.term) query = query.eq('term', filters.term);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name,
      admission_number: d.students?.admission_number,
      class_name: d.students?.classes?.name,
      vote_head_name: d.fees_votehead?.name,
    }));
  },

  // Stats
  async getFeesStats(): Promise<{
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    payment_count: number;
    debit_count: number;
  }> {
    const [debits, payments] = await Promise.all([
      supabase.from('fees_debittransaction').select('amount'),
      supabase.from('fees_paymenttransaction').select('amount'),
    ]);

    const totalInvoiced = (debits.data || []).reduce((sum, d) => sum + Number(d.amount), 0);
    const totalCollected = (payments.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalOutstanding = totalInvoiced - totalCollected;

    return {
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      total_outstanding: Math.max(0, totalOutstanding),
      collection_rate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
      payment_count: (payments.data || []).length,
      debit_count: (debits.data || []).length,
    };
  },
};
