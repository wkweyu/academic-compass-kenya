/**
 * Fees Accounting Service Layer
 * 
 * Implements double-entry accounting principles:
 * - Vote heads (charge categories with priority-based allocation)
 * - Fee structures (per-term charge definitions)
 * - Student ledgers (running debit/credit/balance)
 * - Receipts with unique numbers
 * - Allocations (receipt → votehead breakdown)
 * - Ledger entries (double-entry accounting lines)
 */

import { supabase } from '@/integrations/supabase/client';

// ===================== Types =====================

export interface VoteHead {
  id: number;
  name: string;
  description: string;
  priority: number;
  fee_applicable: boolean;
  student_group: string;
  school_id: number;
}

export interface StructureGroup {
  id: number;
  school_id: number;
  name: string;
  academic_year: number;
  term: number;
  student_group: string;
  is_active: boolean;
  created_at: string;
  items?: StructureItem[];
  total?: number;
}

export interface StructureItem {
  id: number;
  structure_group_id: number;
  vote_head_id: number;
  vote_head_name?: string;
  amount: number;
}

export interface StudentLedger {
  id: number;
  school_id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  debit_total: number;
  credit_total: number;
  balance: number;
  last_updated: string;
}

export interface Receipt {
  id: number;
  school_id: number;
  receipt_no: string;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  amount: number;
  payment_mode: string;
  reference: string;
  posted_by: number | null;
  term: number;
  year: number;
  remarks: string;
  is_reversed: boolean;
  created_at: string;
  allocations?: Allocation[];
}

export interface Allocation {
  id: number;
  receipt_id: number;
  vote_head_id: number;
  vote_head_name?: string;
  amount: number;
}

export interface LedgerEntry {
  id: number;
  school_id: number;
  entry_date: string;
  account_debit: string;
  account_credit: string;
  amount: number;
  reference: string;
  description: string;
  student_id: number | null;
  receipt_id: number | null;
  created_at: string;
}

export interface StudentStatement {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string;
  debits: DebitTransaction[];
  credits: Receipt[];
  running_balance: number;
  ledger: StudentLedger | null;
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

export interface FeesReport {
  trial_balance: { account: string; debit: number; credit: number }[];
  votehead_collections: { votehead: string; amount: number }[];
  payment_mode_summary: { mode: string; amount: number; count: number }[];
  class_balances: { class_name: string; total_debit: number; total_credit: number; balance: number }[];
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
}

// ===================== Helpers =====================

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

async function getUserId(): Promise<number> {
  const { data } = await supabase.rpc('get_current_user_profile');
  if (!data || (data as any[]).length === 0) throw new Error('Not authenticated');
  return (data as any[])[0].id;
}

// ===================== Service =====================

export const feesService = {
  // ==================== VOTE HEADS ====================

  async getVoteHeads(): Promise<VoteHead[]> {
    const { data, error } = await supabase
      .from('fees_votehead')
      .select('*')
      .order('priority');
    if (error) throw error;
    return (data || []) as unknown as VoteHead[];
  },

  async createVoteHead(voteHead: Omit<VoteHead, 'id' | 'school_id'>): Promise<VoteHead> {
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

  // ==================== FEE STRUCTURES ====================

  async getStructureGroups(year?: number, term?: number): Promise<StructureGroup[]> {
    let query = supabase
      .from('fees_structure_group')
      .select('*')
      .order('created_at', { ascending: false });
    if (year) query = query.eq('academic_year', year);
    if (term) query = query.eq('term', term);
    const { data, error } = await query;
    if (error) throw error;

    // Fetch items for each group
    const groups = (data || []) as unknown as StructureGroup[];
    if (groups.length === 0) return groups;

    const groupIds = groups.map(g => g.id);
    const { data: items, error: itemsErr } = await supabase
      .from('fees_structure_item')
      .select('*, fees_votehead(name)')
      .in('structure_group_id', groupIds);
    if (itemsErr) throw itemsErr;

    const itemsByGroup: Record<number, StructureItem[]> = {};
    (items || []).forEach((item: any) => {
      const gid = item.structure_group_id;
      if (!itemsByGroup[gid]) itemsByGroup[gid] = [];
      itemsByGroup[gid].push({
        ...item,
        vote_head_name: item.fees_votehead?.name,
      });
    });

    return groups.map(g => ({
      ...g,
      items: itemsByGroup[g.id] || [],
      total: (itemsByGroup[g.id] || []).reduce((s, i) => s + Number(i.amount), 0),
    }));
  },

  async createStructureGroup(
    name: string, academic_year: number, term: number, student_group: string,
    items: { vote_head_id: number; amount: number }[]
  ): Promise<StructureGroup> {
    const schoolId = await getSchoolId();
    const { data: group, error } = await supabase
      .from('fees_structure_group')
      .insert({ school_id: schoolId, name, academic_year, term, student_group })
      .select()
      .single();
    if (error) throw error;

    if (items.length > 0) {
      const { error: itemsErr } = await supabase
        .from('fees_structure_item')
        .insert(items.map(i => ({ structure_group_id: (group as any).id, vote_head_id: i.vote_head_id, amount: i.amount })));
      if (itemsErr) throw itemsErr;
    }

    return group as unknown as StructureGroup;
  },

  async deleteStructureGroup(id: number): Promise<void> {
    const { error } = await supabase.from('fees_structure_group').delete().eq('id', id);
    if (error) throw error;
  },

  async copyLastYearStructure(fromYear: number, fromTerm: number, toYear: number, toTerm: number): Promise<void> {
    const groups = await this.getStructureGroups(fromYear, fromTerm);
    const schoolId = await getSchoolId();
    for (const group of groups) {
      await this.createStructureGroup(
        group.name, toYear, toTerm, group.student_group,
        (group.items || []).map(i => ({ vote_head_id: i.vote_head_id, amount: Number(i.amount) }))
      );
    }
  },

  // ==================== BULK DEBIT (Post Term Fees) ====================

  async postTermFeesBulk(structureGroupId: number, studentIds: number[], term: number, year: number): Promise<{ count: number }> {
    const schoolId = await getSchoolId();

    // Get structure items
    const { data: items, error: itemsErr } = await supabase
      .from('fees_structure_item')
      .select('*, fees_votehead(name)')
      .eq('structure_group_id', structureGroupId);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) throw new Error('No items in this fee structure');

    let count = 0;
    for (const studentId of studentIds) {
      for (const item of items) {
        const invoiceNo = `INV-${year}${String(term).padStart(1, '0')}-${studentId}-${item.vote_head_id}`;
        
        // Create debit transaction
        await supabase.from('fees_debittransaction').upsert({
          school_id: schoolId,
          student_id: studentId,
          vote_head_id: item.vote_head_id,
          amount: item.amount,
          term, year,
          date: new Date().toISOString(),
          invoice_number: invoiceNo,
          remarks: `Term ${term} ${year} - ${(item as any).fees_votehead?.name || 'Fee'}`,
        }, { onConflict: 'school_id,student_id,vote_head_id,year,term' });

        // Update fee balance
        const { data: existing } = await supabase
          .from('fees_feebalance')
          .select('id, opening_balance, amount_invoiced, amount_paid')
          .eq('school_id', schoolId)
          .eq('student_id', studentId)
          .eq('vote_head_id', item.vote_head_id)
          .eq('year', year)
          .eq('term', term)
          .maybeSingle();

        if (existing) {
          const openingBalance = Number((existing as any).opening_balance || 0);
          const amountPaid = Number((existing as any).amount_paid || 0);
          const invoicedAmount = Number(item.amount);
          const normalizedClosing = Math.max(0, openingBalance + invoicedAmount - amountPaid);

          await supabase.from('fees_feebalance').update({
            amount_invoiced: invoicedAmount,
            closing_balance: normalizedClosing,
          }).eq('id', (existing as any).id);
        } else {
          await supabase.from('fees_feebalance').insert({
            school_id: schoolId, student_id: studentId, vote_head_id: item.vote_head_id,
            year, term, opening_balance: 0, amount_invoiced: item.amount, amount_paid: 0,
            closing_balance: item.amount,
          });
        }

        // Update student ledger
        await this._updateStudentLedger(schoolId, studentId, Number(item.amount), 0);

        // Create double-entry ledger entry (Debit: Accounts Receivable, Credit: Fee Income)
        await supabase.from('fees_ledger_entry').insert({
          school_id: schoolId,
          account_debit: 'Accounts Receivable',
          account_credit: `Fee Income - ${(item as any).fees_votehead?.name || 'Fee'}`,
          amount: item.amount,
          reference: invoiceNo,
          description: `Term ${term} ${year} fee charge`,
          student_id: studentId,
        });

        count++;
      }
    }
    return { count };
  },

  // ==================== COLLECT PAYMENT ====================

  async collectPayment(params: {
    student_id: number;
    amount: number;
    payment_mode: string;
    reference: string;
    term: number;
    year: number;
    remarks?: string;
  }): Promise<Receipt> {
    const schoolId = await getSchoolId();
    let userId: number | null = null;
    try { userId = await getUserId(); } catch {}

    // 1. Generate unique receipt number
    const { data: receiptNo } = await supabase.rpc('generate_receipt_number', { p_school_id: schoolId });
    if (!receiptNo) throw new Error('Failed to generate receipt number');

    // 2. Create receipt
    const { data: receipt, error: receiptErr } = await supabase
      .from('fees_receipt')
      .insert({
        school_id: schoolId,
        receipt_no: receiptNo as string,
        student_id: params.student_id,
        amount: params.amount,
        payment_mode: params.payment_mode,
        reference: params.reference,
        posted_by: userId,
        term: params.term,
        year: params.year,
        remarks: params.remarks || '',
      })
      .select()
      .single();
    if (receiptErr) throw receiptErr;

    // 3. Auto-allocate by votehead priority
    const allocations = await this._allocatePayment(
      schoolId, params.student_id, params.amount, params.term, params.year, (receipt as any).id
    );

    // 4. Update student ledger (credit side)
    await this._updateStudentLedger(schoolId, params.student_id, 0, params.amount);

    // 5. Create double-entry ledger entry (Debit: Cash/Bank, Credit: Accounts Receivable)
    const debitAccount = params.payment_mode === 'mpesa' ? 'M-PESA' :
      params.payment_mode === 'bank' ? 'Bank' : 'Cash';
    await supabase.from('fees_ledger_entry').insert({
      school_id: schoolId,
      account_debit: debitAccount,
      account_credit: 'Accounts Receivable',
      amount: params.amount,
      reference: receiptNo as string,
      description: `Payment received - ${params.payment_mode}`,
      student_id: params.student_id,
      receipt_id: (receipt as any).id,
    });

    // 6. Also record in legacy payment transactions table for backward compat
    await supabase.from('fees_paymenttransaction').insert({
      school_id: schoolId,
      student_id: params.student_id,
      amount: params.amount,
      mode: params.payment_mode,
      transaction_code: params.reference,
      date: new Date().toISOString(),
      remarks: params.remarks || '',
      apportion_log: allocations,
    });

    return { ...(receipt as any), allocations } as Receipt;
  },

  // ==================== PAYMENT ALLOCATION ====================

  async _allocatePayment(
    schoolId: number, studentId: number, amount: number, term: number, year: number, receiptId: number
  ): Promise<Allocation[]> {
    // Get voteheads ordered by priority
    const { data: voteheads } = await supabase
      .from('fees_votehead')
      .select('id, name, priority')
      .eq('fee_applicable', true)
      .order('priority')
      .order('id');

    const allocations: Allocation[] = [];
    let remaining = amount;

    // Allocate to balances by votehead priority using normalized outstanding (amount_invoiced - amount_paid)
    for (const vh of (voteheads || [])) {
      if (remaining <= 0) break;

      const { data: balances } = await supabase
        .from('fees_feebalance')
        .select('id, amount_invoiced, amount_paid, closing_balance, term, year')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('vote_head_id', vh.id)
        .order('year', { ascending: true })
        .order('term', { ascending: true });

      if (!balances || balances.length === 0) continue;

      for (const balance of balances) {
        if (remaining <= 0) break;

        const invoiced = Number((balance as any).amount_invoiced || 0);
        const paid = Number((balance as any).amount_paid || 0);
        const normalizedOutstanding = Math.max(0, invoiced - paid);

        if (normalizedOutstanding <= 0) {
          // Heal stale closing balance records so future reads stay accurate
          if (Number((balance as any).closing_balance || 0) !== 0) {
            await supabase
              .from('fees_feebalance')
              .update({ closing_balance: 0 })
              .eq('id', (balance as any).id);
          }
          continue;
        }

        const allocate = Math.min(remaining, normalizedOutstanding);

        // Create allocation record
        const { data: alloc } = await supabase
          .from('fees_allocation')
          .insert({
            school_id: schoolId,
            receipt_id: receiptId,
            vote_head_id: vh.id,
            amount: allocate,
          })
          .select()
          .single();

        const newPaid = paid + allocate;
        const newClosing = Math.max(0, invoiced - newPaid);

        // Update fee balance with normalized values
        await supabase
          .from('fees_feebalance')
          .update({
            amount_paid: newPaid,
            closing_balance: newClosing,
          })
          .eq('id', (balance as any).id);

        // Add to existing allocation for same votehead or create new
        const existingAlloc = allocations.find(a => a.vote_head_id === vh.id);
        if (existingAlloc) {
          existingAlloc.amount += allocate;
        } else {
          allocations.push({
            id: (alloc as any)?.id || 0,
            receipt_id: receiptId,
            vote_head_id: vh.id,
            vote_head_name: vh.name,
            amount: allocate,
          });
        }

        remaining -= allocate;
      }
    }


    // If there's remaining amount (overpayment), record as excess on first votehead
    if (remaining > 0) {
      const firstVh = (voteheads || [])[0];
      await supabase.from('fees_allocation').insert({
        school_id: schoolId,
        receipt_id: receiptId,
        vote_head_id: firstVh?.id || 0,
        amount: remaining,
      });
      const existingAlloc = allocations.find(a => a.vote_head_id === firstVh?.id);
      if (existingAlloc) {
        existingAlloc.amount += remaining;
      } else {
        allocations.push({
          id: 0,
          receipt_id: receiptId,
          vote_head_id: firstVh?.id || 0,
          vote_head_name: firstVh?.name || 'Excess',
          amount: remaining,
        });
      }
    }

    return allocations;
  },

  // ==================== STUDENT LEDGER ====================

  async _updateStudentLedger(schoolId: number, studentId: number, _debitAdd: number, _creditAdd: number): Promise<void> {
    // Recalculate from actual data to prevent drift from duplicate calls
    const [debitsRes, receiptsRes] = await Promise.all([
      supabase.from('fees_debittransaction').select('amount').eq('school_id', schoolId).eq('student_id', studentId),
      supabase.from('fees_receipt').select('amount').eq('school_id', schoolId).eq('student_id', studentId).eq('is_reversed', false),
    ]);

    const debitTotal = (debitsRes.data || []).reduce((s, d) => s + Number((d as any).amount), 0);
    const creditTotal = (receiptsRes.data || []).reduce((s, r) => s + Number((r as any).amount), 0);

    const { data: existing } = await supabase
      .from('fees_student_ledger')
      .select('id')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      await supabase.from('fees_student_ledger').update({
        debit_total: debitTotal,
        credit_total: creditTotal,
        balance: debitTotal - creditTotal,
        last_updated: new Date().toISOString(),
      }).eq('id', (existing as any).id);
    } else {
      await supabase.from('fees_student_ledger').insert({
        school_id: schoolId,
        student_id: studentId,
        debit_total: debitTotal,
        credit_total: creditTotal,
        balance: debitTotal - creditTotal,
      });
    }
  },

  // ==================== STUDENT STATEMENT ====================

  async getStudentStatement(studentId: number): Promise<StudentStatement> {
    const [studentRes, debitsRes, receiptsRes, ledgerRes] = await Promise.all([
      supabase.from('students').select('id, full_name, admission_number, current_class_id, classes(name)').eq('id', studentId).single(),
      supabase.from('fees_debittransaction')
        .select('*, fees_votehead(name)')
        .eq('student_id', studentId)
        .order('date', { ascending: true }),
      supabase.from('fees_receipt')
        .select('*, fees_allocation(*, fees_votehead(name))')
        .eq('student_id', studentId)
        .eq('is_reversed', false)
        .order('created_at', { ascending: true }),
      supabase.from('fees_student_ledger')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle(),
    ]);

    const student = studentRes.data as any;
    return {
      student_id: studentId,
      student_name: student?.full_name || '',
      admission_number: student?.admission_number || '',
      class_name: student?.classes?.name || '',
      debits: (debitsRes.data || []).map((d: any) => ({
        ...d,
        vote_head_name: d.fees_votehead?.name,
      })),
      credits: (receiptsRes.data || []).map((r: any) => ({
        ...r,
        allocations: (r.fees_allocation || []).map((a: any) => ({
          ...a,
          vote_head_name: a.fees_votehead?.name,
        })),
      })),
      running_balance: Number((ledgerRes.data as any)?.balance || 0),
      ledger: ledgerRes.data as unknown as StudentLedger,
    };
  },

  // ==================== RECEIPTS ====================

  async getReceipts(filters?: { student_id?: number; term?: number; year?: number }): Promise<Receipt[]> {
    let query = supabase
      .from('fees_receipt')
      .select('*, students(full_name, admission_number), fees_allocation(*, fees_votehead(name))')
      .order('created_at', { ascending: false });
    if (filters?.student_id) query = query.eq('student_id', filters.student_id);
    if (filters?.term) query = query.eq('term', filters.term);
    if (filters?.year) query = query.eq('year', filters.year);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r: any) => ({
      ...r,
      student_name: r.students?.full_name,
      admission_number: r.students?.admission_number,
      allocations: (r.fees_allocation || []).map((a: any) => ({
        ...a,
        vote_head_name: a.fees_votehead?.name,
      })),
    }));
  },

  // ==================== STUDENT LEDGERS (list) ====================

  async getStudentLedgers(): Promise<StudentLedger[]> {
    const { data, error } = await supabase
      .from('fees_student_ledger')
      .select('*, students(full_name, admission_number, current_class_id, classes(name))')
      .order('balance', { ascending: false });
    if (error) throw error;
    return (data || []).map((l: any) => ({
      ...l,
      student_name: l.students?.full_name,
      admission_number: l.students?.admission_number,
      class_name: l.students?.classes?.name,
    }));
  },

  // ==================== REPORTS ====================

  async generateReports(): Promise<FeesReport> {
    const [ledgerEntries, receipts, debits, allocations] = await Promise.all([
      supabase.from('fees_ledger_entry').select('*'),
      supabase.from('fees_receipt').select('*').eq('is_reversed', false),
      supabase.from('fees_debittransaction').select('*'),
      supabase.from('fees_allocation').select('*, fees_votehead(name)'),
    ]);

    // Trial Balance
    const accounts: Record<string, { debit: number; credit: number }> = {};
    (ledgerEntries.data || []).forEach((e: any) => {
      if (!accounts[e.account_debit]) accounts[e.account_debit] = { debit: 0, credit: 0 };
      if (!accounts[e.account_credit]) accounts[e.account_credit] = { debit: 0, credit: 0 };
      accounts[e.account_debit].debit += Number(e.amount);
      accounts[e.account_credit].credit += Number(e.amount);
    });
    const trial_balance = Object.entries(accounts).map(([account, vals]) => ({
      account, debit: vals.debit, credit: vals.credit,
    }));

    // Votehead collections
    const vhCollections: Record<string, number> = {};
    (allocations.data || []).forEach((a: any) => {
      const name = a.fees_votehead?.name || 'Unknown';
      vhCollections[name] = (vhCollections[name] || 0) + Number(a.amount);
    });
    const votehead_collections = Object.entries(vhCollections).map(([votehead, amount]) => ({
      votehead, amount,
    }));

    // Payment mode summary
    const modeSummary: Record<string, { amount: number; count: number }> = {};
    (receipts.data || []).forEach((r: any) => {
      const mode = r.payment_mode || 'cash';
      if (!modeSummary[mode]) modeSummary[mode] = { amount: 0, count: 0 };
      modeSummary[mode].amount += Number(r.amount);
      modeSummary[mode].count++;
    });
    const payment_mode_summary = Object.entries(modeSummary).map(([mode, vals]) => ({
      mode, ...vals,
    }));

    // Totals
    const total_invoiced = (debits.data || []).reduce((s, d: any) => s + Number(d.amount), 0);
    const total_collected = (receipts.data || []).reduce((s, r: any) => s + Number(r.amount), 0);

    return {
      trial_balance,
      votehead_collections,
      payment_mode_summary,
      class_balances: [], // Would need a join with students/classes
      total_invoiced,
      total_collected,
      total_outstanding: Math.max(0, total_invoiced - total_collected),
      collection_rate: total_invoiced > 0 ? Math.round((total_collected / total_invoiced) * 100) : 0,
    };
  },

  // ==================== LEGACY COMPAT ====================

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

  // ==================== MPESA PLACEHOLDER ====================

  async processMpesaCallback(data: {
    student_id: number;
    amount: number;
    mpesa_code: string;
    term: number;
    year: number;
  }): Promise<Receipt> {
    return this.collectPayment({
      student_id: data.student_id,
      amount: data.amount,
      payment_mode: 'mpesa',
      reference: data.mpesa_code,
      term: data.term,
      year: data.year,
      remarks: `M-PESA auto-payment: ${data.mpesa_code}`,
    });
  },

  // ==================== STATS ====================

  async getFeesStats(): Promise<{
    total_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
    payment_count: number;
    debit_count: number;
    students_owing: number;
    students_clear: number;
  }> {
    const [debits, receipts, ledgers] = await Promise.all([
      supabase.from('fees_debittransaction').select('amount'),
      supabase.from('fees_receipt').select('amount').eq('is_reversed', false),
      supabase.from('fees_student_ledger').select('balance'),
    ]);

    const totalInvoiced = (debits.data || []).reduce((s, d: any) => s + Number(d.amount), 0);
    const totalCollected = (receipts.data || []).reduce((s, r: any) => s + Number(r.amount), 0);
    const studentsOwing = (ledgers.data || []).filter((l: any) => Number(l.balance) > 0).length;
    const studentsClear = (ledgers.data || []).filter((l: any) => Number(l.balance) <= 0).length;

    return {
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      total_outstanding: Math.max(0, totalInvoiced - totalCollected),
      collection_rate: totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0,
      payment_count: (receipts.data || []).length,
      debit_count: (debits.data || []).length,
      students_owing: studentsOwing,
      students_clear: studentsClear,
    };
  },
};
