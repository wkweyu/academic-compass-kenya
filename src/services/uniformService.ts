/**
 * Uniform POS Service
 * Issues uniform items to students and auto-debits their fee accounts.
 * Supports class-group-based pricing tiers.
 */
import { supabase } from '@/integrations/supabase/client';
import { feesService } from './feesService';

export interface UniformItem {
  id: number;
  name: string;
  unit_price: number;
  category_name?: string;
  reorder_level: number;
  is_consumable: boolean;
}

export interface ClassGroup {
  id: number;
  school_id: number;
  name: string;
  min_grade_level: number;
  max_grade_level: number;
}

export interface ItemPrice {
  id: number;
  item_id: number;
  class_group_id: number;
  class_group_name?: string;
  price: number;
}

export interface CartItem {
  item_id: number;
  item_name: string;
  unit_price: number;
  quantity: number;
  total: number;
  class_group_name?: string;
}

export interface UniformIssue {
  id: number;
  school_id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  issued_by: number | null;
  total_amount: number;
  term: number;
  year: number;
  remarks: string;
  store_issued: boolean;
  store_issued_at?: string;
  created_at: string;
  items?: UniformIssueItem[];
}

export interface UniformIssueItem {
  id: number;
  issue_id: number;
  item_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  class_group_name?: string;
}

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

export const uniformService = {
  // ============ CLASS GROUPS ============

  async getClassGroups(): Promise<ClassGroup[]> {
    const { data, error } = await supabase
      .from('uniform_class_groups')
      .select('*')
      .order('min_grade_level');
    if (error) throw error;
    return (data || []) as unknown as ClassGroup[];
  },

  async createClassGroup(group: Omit<ClassGroup, 'id'>): Promise<ClassGroup> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('uniform_class_groups')
      .insert({ ...group, school_id: schoolId })
      .select()
      .single();
    if (error) throw error;
    return data as unknown as ClassGroup;
  },

  async deleteClassGroup(id: number): Promise<void> {
    const { error } = await supabase.from('uniform_class_groups').delete().eq('id', id);
    if (error) throw error;
  },

  // ============ ITEM PRICES ============

  async getItemPrices(itemId?: number): Promise<ItemPrice[]> {
    let query = supabase
      .from('uniform_item_prices')
      .select('*, uniform_class_groups(name)')
      .order('class_group_id');
    if (itemId) query = query.eq('item_id', itemId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      item_id: d.item_id,
      class_group_id: d.class_group_id,
      class_group_name: d.uniform_class_groups?.name,
      price: Number(d.price),
    }));
  },

  async upsertItemPrice(params: { item_id: number; class_group_id: number; price: number }): Promise<void> {
    const schoolId = await getSchoolId();
    const { error } = await supabase
      .from('uniform_item_prices')
      .upsert({
        school_id: schoolId,
        item_id: params.item_id,
        class_group_id: params.class_group_id,
        price: params.price,
      }, { onConflict: 'school_id,item_id,class_group_id' });
    if (error) throw error;
  },

  async deleteItemPrice(id: number): Promise<void> {
    const { error } = await supabase.from('uniform_item_prices').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Resolve the price for an item based on a student's grade level.
   * Falls back to the item's default unit_price if no class-group price is set.
   */
  async resolvePrice(item: UniformItem, gradeLevel: number): Promise<{ price: number; classGroupName: string }> {
    const { data } = await supabase
      .from('uniform_item_prices')
      .select('price, uniform_class_groups(name, min_grade_level, max_grade_level)')
      .eq('item_id', item.id);

    if (data && data.length > 0) {
      const match = (data as any[]).find(d => {
        const g = d.uniform_class_groups;
        return g && gradeLevel >= g.min_grade_level && gradeLevel <= g.max_grade_level;
      });
      if (match) {
        return { price: Number(match.price), classGroupName: match.uniform_class_groups.name };
      }
    }
    return { price: item.unit_price, classGroupName: 'Default' };
  },

  // ============ UNIFORM ITEMS ============

  async getUniformItems(): Promise<UniformItem[]> {
    const { data: categories } = await supabase
      .from('procurement_itemcategory')
      .select('id, name')
      .ilike('name', '%uniform%');

    if (!categories || categories.length === 0) return [];

    const categoryIds = categories.map((c: any) => c.id);
    const { data, error } = await supabase
      .from('procurement_item')
      .select('id, name, unit_price, reorder_level, is_consumable, category_id, procurement_itemcategory(name)')
      .in('category_id', categoryIds)
      .order('name');

    if (error) throw error;
    return (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      unit_price: Number(d.unit_price),
      category_name: d.procurement_itemcategory?.name,
      reorder_level: d.reorder_level,
      is_consumable: d.is_consumable,
    }));
  },

  // ============ ISSUE UNIFORM ============

  async issueUniform(params: {
    student_id: number;
    items: CartItem[];
    term: number;
    year: number;
    remarks?: string;
  }): Promise<UniformIssue> {
    const schoolId = await getSchoolId();
    const userId = await getUserId();
    const totalAmount = params.items.reduce((s, i) => s + i.total, 0);

    // 1. Create uniform_issues record
    const { data: issue, error: issueErr } = await supabase
      .from('uniform_issues')
      .insert({
        school_id: schoolId,
        student_id: params.student_id,
        issued_by: userId,
        total_amount: totalAmount,
        term: params.term,
        year: params.year,
        remarks: params.remarks || '',
      })
      .select()
      .single();
    if (issueErr) throw issueErr;

    const issueId = (issue as any).id;

    // 2. Insert line items
    const lineItems = params.items.map(item => ({
      issue_id: issueId,
      item_id: item.item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      class_group_name: item.class_group_name || '',
    }));

    const { error: itemsErr } = await supabase
      .from('uniform_issue_items')
      .insert(lineItems);
    if (itemsErr) throw itemsErr;

    // 3. Find "Uniform" votehead
    const { data: voteheads } = await supabase
      .from('fees_votehead')
      .select('id, name')
      .eq('school_id', schoolId);

    const uniformVh = (voteheads || []).find((vh: any) =>
      vh.name.toLowerCase().includes('uniform')
    );
    if (!uniformVh) throw new Error('No "Uniform" vote head found. Please create one under Vote Heads first.');
    const voteHeadId = (uniformVh as any).id;

    // 4. Create fees_debittransaction
    const invoiceNo = `UNI-${params.year}T${params.term}-${params.student_id}-${Date.now()}`;
    const itemNames = params.items.map(i => `${i.item_name} x${i.quantity}`).join(', ');

    await supabase.from('fees_debittransaction').insert({
      school_id: schoolId,
      student_id: params.student_id,
      vote_head_id: voteHeadId,
      amount: totalAmount,
      term: params.term,
      year: params.year,
      date: new Date().toISOString(),
      invoice_number: invoiceNo,
      remarks: `Uniform issue: ${itemNames}`,
    });

    // 5. Update fees_feebalance
    const { data: existing } = await supabase
      .from('fees_feebalance')
      .select('id, amount_invoiced, closing_balance')
      .eq('school_id', schoolId)
      .eq('student_id', params.student_id)
      .eq('vote_head_id', voteHeadId)
      .eq('year', params.year)
      .eq('term', params.term)
      .maybeSingle();

    if (existing) {
      await supabase.from('fees_feebalance').update({
        amount_invoiced: Number((existing as any).amount_invoiced) + totalAmount,
        closing_balance: Number((existing as any).closing_balance) + totalAmount,
      }).eq('id', (existing as any).id);
    } else {
      await supabase.from('fees_feebalance').insert({
        school_id: schoolId,
        student_id: params.student_id,
        vote_head_id: voteHeadId,
        year: params.year,
        term: params.term,
        opening_balance: 0,
        amount_invoiced: totalAmount,
        amount_paid: 0,
        closing_balance: totalAmount,
      });
    }

    // 6. Update student ledger
    await feesService._updateStudentLedger(schoolId, params.student_id, totalAmount, 0);

    // 7. Double-entry ledger entry
    await supabase.from('fees_ledger_entry').insert({
      school_id: schoolId,
      account_debit: 'Accounts Receivable',
      account_credit: 'Uniform Sales',
      amount: totalAmount,
      reference: invoiceNo,
      description: `Uniform issue: ${itemNames}`,
      student_id: params.student_id,
    });

    // 8. Stock transactions (deduct inventory)
    for (const item of params.items) {
      await supabase.from('procurement_stocktransaction').insert({
        school_id: schoolId,
        item_id: item.item_id,
        transaction_type: 'Issue',
        quantity: item.quantity,
        description: `Issued to student #${params.student_id}`,
        issued_to: `Student #${params.student_id}`,
      });
    }

    return {
      ...(issue as any),
      items: lineItems,
    } as UniformIssue;
  },

  // ============ ISSUE HISTORY ============

  async getIssueHistory(studentId?: number): Promise<UniformIssue[]> {
    let query = supabase
      .from('uniform_issues')
      .select('*, students(full_name, admission_number, current_class_id, classes(name))')
      .order('created_at', { ascending: false })
      .limit(100);

    if (studentId) query = query.eq('student_id', studentId);

    const { data, error } = await query;
    if (error) throw error;

    const issues = (data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name,
      admission_number: d.students?.admission_number,
      class_name: d.students?.classes?.name,
    })) as UniformIssue[];

    // Fetch items for each issue
    if (issues.length > 0) {
      const issueIds = issues.map(i => i.id);
      const { data: items } = await supabase
        .from('uniform_issue_items')
        .select('*')
        .in('issue_id', issueIds);

      const itemsByIssue: Record<number, UniformIssueItem[]> = {};
      for (const item of (items || []) as any[]) {
        if (!itemsByIssue[item.issue_id]) itemsByIssue[item.issue_id] = [];
        itemsByIssue[item.issue_id].push(item);
      }
      for (const issue of issues) {
        issue.items = itemsByIssue[issue.id] || [];
      }
    }

    return issues;
  },

  // ============ MARK STORE ISSUED ============

  async markStoreIssued(issueId: number): Promise<void> {
    const { error } = await supabase
      .from('uniform_issues')
      .update({ store_issued: true, store_issued_at: new Date().toISOString() })
      .eq('id', issueId);
    if (error) throw error;
  },
};
