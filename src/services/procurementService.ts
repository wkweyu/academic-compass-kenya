import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

// ── Types ──────────────────────────────────────────────

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  kra_pin?: string;
  category?: string;
  opening_balance: number;
  has_student_account: boolean;
  school_id: number;
}

export interface ItemCategory {
  id: number;
  name: string;
  school_id: number;
}

export interface ProcurementItem {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  unit_price: number;
  reorder_level: number;
  is_consumable: boolean;
  preferred_supplier_id?: number;
  preferred_supplier_name?: string;
  school_id: number;
}

export interface LPO {
  id: number;
  lpo_number: string;
  supplier_id: number;
  supplier_name?: string;
  date: string;
  total_amount: number;
  status: string;
  delivery_date?: string;
  delivery_note?: string;
  delivered_by?: string;
  school_id: number;
}

export interface LPOItem {
  id: number;
  lpo_id: number;
  item_id?: number;
  item_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  school_id: number;
}

export interface PaymentVoucher {
  id: number;
  voucher_number: string;
  supplier_id: number;
  supplier_name?: string;
  date: string;
  amount: number;
  payment_mode: string;
  description?: string;
  status: string;
  vote_head_id?: number;
  vote_head_name?: string;
  school_id: number;
}

export interface StockTransaction {
  id: number;
  item_id: number;
  item_name?: string;
  transaction_type: string;
  quantity: number;
  transaction_date: string;
  description?: string;
  issued_to?: string;
  related_lpo_id?: number;
  school_id: number;
}

export interface PettyCashTransaction {
  id: number;
  date: string;
  transaction_type: string;
  amount: number;
  description: string;
  vote_head_id?: number;
  vote_head_name?: string;
  related_voucher_id?: number;
  school_id: number;
}

export interface FeesInKindTransaction {
  id: number;
  date: string;
  supplier_id: number;
  supplier_name?: string;
  student_id: number;
  amount: number;
  vote_head_id?: number;
  term: number;
  year: number;
  school_id: number;
}

export interface StockBalance {
  item_id: number;
  item_name: string;
  category_name: string;
  purchased: number;
  issued: number;
  adjusted: number;
  balance: number;
  reorder_level: number;
  is_low: boolean;
}

export interface SupplierLedgerEntry {
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

// ── Service ────────────────────────────────────────────

export const procurementService = {
  // ── Suppliers ──
  async getSuppliers(): Promise<Supplier[]> {
    const { data, error } = await supabase.from('procurement_supplier').select('*').order('name');
    if (error) throw error;
    return (data || []) as unknown as Supplier[];
  },

  async createSupplier(supplier: Omit<Supplier, 'id'>): Promise<Supplier> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_supplier')
      .insert({ ...supplier, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as Supplier;
  },

  async updateSupplier(id: number, updates: Partial<Supplier>): Promise<void> {
    const { error } = await supabase.from('procurement_supplier').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteSupplier(id: number): Promise<void> {
    const { error } = await supabase.from('procurement_supplier').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Item Categories ──
  async getItemCategories(): Promise<ItemCategory[]> {
    const { data, error } = await supabase.from('procurement_itemcategory').select('*').order('name');
    if (error) throw error;
    return (data || []) as unknown as ItemCategory[];
  },

  async createItemCategory(name: string): Promise<ItemCategory> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_itemcategory')
      .insert({ name, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as ItemCategory;
  },

  async deleteItemCategory(id: number): Promise<void> {
    const { error } = await supabase.from('procurement_itemcategory').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Items ──
  async getItems(): Promise<ProcurementItem[]> {
    const { data, error } = await supabase
      .from('procurement_item')
      .select('*, procurement_itemcategory(name), procurement_supplier(name)')
      .order('name');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      category_name: d.procurement_itemcategory?.name,
      preferred_supplier_name: d.procurement_supplier?.name,
    }));
  },

  async createItem(item: Omit<ProcurementItem, 'id' | 'category_name' | 'preferred_supplier_name'>): Promise<ProcurementItem> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_item')
      .insert({ ...item, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as ProcurementItem;
  },

  async updateItem(id: number, updates: Partial<ProcurementItem>): Promise<void> {
    const { error } = await supabase.from('procurement_item').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteItem(id: number): Promise<void> {
    const { error } = await supabase.from('procurement_item').delete().eq('id', id);
    if (error) throw error;
  },

  // ── Auto-numbering ──
  async generateLPONumber(): Promise<string> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase.rpc('generate_lpo_number', { p_school_id: schoolId });
    if (error) throw error;
    return data as string;
  },

  async generatePVNumber(): Promise<string> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase.rpc('generate_pv_number', { p_school_id: schoolId });
    if (error) throw error;
    return data as string;
  },

  // ── LPOs ──
  async getLPOs(): Promise<LPO[]> {
    const { data, error } = await supabase
      .from('procurement_lpo')
      .select('*, procurement_supplier(name)')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      supplier_name: d.procurement_supplier?.name,
    }));
  },

  async createLPO(lpo: Omit<LPO, 'id' | 'supplier_name'>): Promise<LPO> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_lpo')
      .insert({ ...lpo, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as LPO;
  },

  async updateLPO(id: number, updates: Partial<LPO>): Promise<void> {
    const { error } = await supabase.from('procurement_lpo').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteLPO(id: number): Promise<void> {
    const { error } = await supabase.from('procurement_lpo').delete().eq('id', id);
    if (error) throw error;
  },

  // ── LPO Items ──
  async getLPOItems(lpoId: number): Promise<LPOItem[]> {
    const { data, error } = await supabase
      .from('procurement_lpo_items')
      .select('*, procurement_item(name)')
      .eq('lpo_id', lpoId)
      .order('id');
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      item_name: d.procurement_item?.name,
    }));
  },

  async addLPOItem(item: Omit<LPOItem, 'id' | 'item_name'>): Promise<LPOItem> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_lpo_items')
      .insert({ ...item, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as LPOItem;
  },

  async removeLPOItem(id: number): Promise<void> {
    const { error } = await supabase.from('procurement_lpo_items').delete().eq('id', id);
    if (error) throw error;
  },

  async recalculateLPOTotal(lpoId: number): Promise<void> {
    const items = await this.getLPOItems(lpoId);
    const total = items.reduce((s, i) => s + Number(i.total_price), 0);
    await this.updateLPO(lpoId, { total_amount: total } as any);
  },

  // ── LPO Lifecycle ──
  async approveLPO(id: number): Promise<void> {
    await this.updateLPO(id, { status: 'Approved' } as any);
  },

  async deliverLPO(id: number, deliveryNote: string, deliveredBy: string): Promise<void> {
    // Update LPO status
    const { error } = await supabase.from('procurement_lpo').update({
      status: 'Delivered',
      delivery_date: new Date().toISOString().split('T')[0],
      delivery_note: deliveryNote,
      delivered_by: deliveredBy,
    }).eq('id', id);
    if (error) throw error;

    // Get LPO items and create stock Purchase transactions
    const items = await this.getLPOItems(id);
    const schoolId = await getSchoolId();
    for (const item of items) {
      if (item.item_id) {
        await supabase.from('procurement_stocktransaction').insert({
          item_id: item.item_id,
          transaction_type: 'Purchase',
          quantity: item.quantity,
          transaction_date: new Date().toISOString(),
          related_lpo_id: id,
          description: `Goods received: ${item.description}`,
          school_id: schoolId,
        });
      }
    }
  },

  // ── Payment Vouchers ──
  async getPaymentVouchers(): Promise<PaymentVoucher[]> {
    const { data, error } = await supabase
      .from('procurement_paymentvoucher')
      .select('*, procurement_supplier(name), fees_votehead(name)')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      supplier_name: d.procurement_supplier?.name,
      vote_head_name: d.fees_votehead?.name,
    }));
  },

  async createPaymentVoucher(voucher: Omit<PaymentVoucher, 'id' | 'supplier_name' | 'vote_head_name'>): Promise<PaymentVoucher> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_paymentvoucher')
      .insert({ ...voucher, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as PaymentVoucher;
  },

  async updatePaymentVoucher(id: number, updates: Partial<PaymentVoucher>): Promise<void> {
    const { error } = await supabase.from('procurement_paymentvoucher').update(updates).eq('id', id);
    if (error) throw error;
  },

  async approveVoucher(id: number): Promise<void> {
    await this.updatePaymentVoucher(id, { status: 'Approved' } as any);
  },

  async payVoucher(id: number): Promise<void> {
    await this.updatePaymentVoucher(id, { status: 'Paid' } as any);
  },

  // ── Stock Transactions ──
  async getStockTransactions(itemId?: number): Promise<StockTransaction[]> {
    let query = supabase
      .from('procurement_stocktransaction')
      .select('*, procurement_item(name)')
      .order('transaction_date', { ascending: false });
    if (itemId) query = query.eq('item_id', itemId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      item_name: d.procurement_item?.name,
    }));
  },

  async createStockTransaction(tx: Omit<StockTransaction, 'id' | 'item_name'>): Promise<StockTransaction> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_stocktransaction')
      .insert({ ...tx, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as StockTransaction;
  },

  // ── Stock Balances ──
  async getStockBalances(): Promise<StockBalance[]> {
    const [itemsRes, txRes] = await Promise.all([
      supabase.from('procurement_item').select('id, name, reorder_level, procurement_itemcategory(name)'),
      supabase.from('procurement_stocktransaction').select('item_id, transaction_type, quantity'),
    ]);
    if (itemsRes.error) throw itemsRes.error;
    if (txRes.error) throw txRes.error;

    const txByItem: Record<number, { purchased: number; issued: number; adjusted: number }> = {};
    for (const tx of txRes.data || []) {
      if (!txByItem[tx.item_id]) txByItem[tx.item_id] = { purchased: 0, issued: 0, adjusted: 0 };
      const qty = Number(tx.quantity);
      if (tx.transaction_type === 'Purchase') txByItem[tx.item_id].purchased += qty;
      else if (tx.transaction_type === 'Issue') txByItem[tx.item_id].issued += qty;
      else txByItem[tx.item_id].adjusted += qty;
    }

    return (itemsRes.data || []).map((item: any) => {
      const t = txByItem[item.id] || { purchased: 0, issued: 0, adjusted: 0 };
      const balance = t.purchased - t.issued + t.adjusted;
      return {
        item_id: item.id,
        item_name: item.name,
        category_name: item.procurement_itemcategory?.name || '',
        purchased: t.purchased,
        issued: t.issued,
        adjusted: t.adjusted,
        balance,
        reorder_level: item.reorder_level,
        is_low: balance <= item.reorder_level,
      };
    });
  },

  // ── Petty Cash ──
  async getPettyCash(): Promise<PettyCashTransaction[]> {
    const { data, error } = await supabase
      .from('procurement_pettycashtransaction')
      .select('*, fees_votehead(name)')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      vote_head_name: d.fees_votehead?.name,
    }));
  },

  async createPettyCash(tx: Omit<PettyCashTransaction, 'id' | 'vote_head_name'>): Promise<PettyCashTransaction> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_pettycashtransaction')
      .insert({ ...tx, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as PettyCashTransaction;
  },

  // ── Fees In-Kind ──
  async getFeesInKind(): Promise<FeesInKindTransaction[]> {
    const { data, error } = await supabase
      .from('procurement_feesinkindtransaction')
      .select('*, procurement_supplier(name)')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      supplier_name: d.procurement_supplier?.name,
    }));
  },

  async createFeesInKind(tx: Omit<FeesInKindTransaction, 'id' | 'supplier_name'>): Promise<FeesInKindTransaction> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_feesinkindtransaction')
      .insert({ ...tx, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as FeesInKindTransaction;
  },

  // ── Supplier Ledger ──
  async getSupplierLedger(supplierId: number): Promise<{ entries: SupplierLedgerEntry[]; openingBalance: number }> {
    const [supplierRes, lpoRes, voucherRes, fikRes] = await Promise.all([
      supabase.from('procurement_supplier').select('opening_balance').eq('id', supplierId).single(),
      supabase.from('procurement_lpo').select('lpo_number, date, total_amount, status').eq('supplier_id', supplierId).order('date'),
      supabase.from('procurement_paymentvoucher').select('voucher_number, date, amount, status').eq('supplier_id', supplierId).order('date'),
      supabase.from('procurement_feesinkindtransaction').select('date, amount').eq('supplier_id', supplierId).order('date'),
    ]);

    const openingBalance = Number(supplierRes.data?.opening_balance || 0);
    const entries: SupplierLedgerEntry[] = [];

    for (const l of lpoRes.data || []) {
      if (l.status === 'Delivered' || l.status === 'Paid') {
        entries.push({ date: l.date, type: 'LPO', reference: l.lpo_number, debit: Number(l.total_amount), credit: 0, balance: 0 });
      }
    }
    for (const v of voucherRes.data || []) {
      if (v.status === 'Paid') {
        entries.push({ date: v.date, type: 'Payment', reference: v.voucher_number, debit: 0, credit: Number(v.amount), balance: 0 });
      }
    }
    for (const f of fikRes.data || []) {
      entries.push({ date: f.date, type: 'Fees In-Kind', reference: 'FIK', debit: 0, credit: Number(f.amount), balance: 0 });
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    let running = openingBalance;
    for (const e of entries) {
      running += e.debit - e.credit;
      e.balance = running;
    }

    return { entries, openingBalance };
  },

  // ── Vote Heads (for dropdowns) ──
  async getVoteHeads(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await supabase.from('fees_votehead').select('id, name').order('name');
    if (error) throw error;
    return (data || []) as { id: number; name: string }[];
  },

  // ── Stats ──
  async getStats() {
    const [suppliers, items, lpos, vouchers] = await Promise.all([
      supabase.from('procurement_supplier').select('id', { count: 'exact', head: true }),
      supabase.from('procurement_item').select('id', { count: 'exact', head: true }),
      supabase.from('procurement_lpo').select('total_amount, status'),
      supabase.from('procurement_paymentvoucher').select('amount, status'),
    ]);

    const pendingLPOs = (lpos.data || []).filter(l => l.status === 'Pending');
    const totalLPOValue = (lpos.data || []).reduce((s, l) => s + Number(l.total_amount), 0);
    const totalVoucherValue = (vouchers.data || []).reduce((s, v) => s + Number(v.amount), 0);

    return {
      supplier_count: suppliers.count || 0,
      item_count: items.count || 0,
      pending_lpos: pendingLPOs.length,
      total_lpo_value: totalLPOValue,
      total_voucher_value: totalVoucherValue,
    };
  },
};
