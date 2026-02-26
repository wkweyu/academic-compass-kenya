import { supabase } from '@/integrations/supabase/client';

async function getSchoolId(): Promise<number> {
  const { data } = await supabase.rpc('get_user_school_id');
  if (!data) throw new Error('No school assigned');
  return data as number;
}

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

export const procurementService = {
  // Suppliers
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

  // Item Categories
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

  // Items
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

  // LPOs
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

  // Payment Vouchers
  async getPaymentVouchers(): Promise<PaymentVoucher[]> {
    const { data, error } = await supabase
      .from('procurement_paymentvoucher')
      .select('*, procurement_supplier(name)')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      supplier_name: d.procurement_supplier?.name,
    }));
  },

  async createPaymentVoucher(voucher: Omit<PaymentVoucher, 'id' | 'supplier_name'>): Promise<PaymentVoucher> {
    const schoolId = await getSchoolId();
    const { data, error } = await supabase
      .from('procurement_paymentvoucher')
      .insert({ ...voucher, school_id: schoolId })
      .select().single();
    if (error) throw error;
    return data as unknown as PaymentVoucher;
  },

  // Stock Transactions
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

  // Stats
  async getStats() {
    const [suppliers, items, lpos, vouchers] = await Promise.all([
      supabase.from('procurement_supplier').select('id', { count: 'exact', head: true }),
      supabase.from('procurement_item').select('id', { count: 'exact', head: true }),
      supabase.from('procurement_lpo').select('total_amount, status'),
      supabase.from('procurement_paymentvoucher').select('amount, status'),
    ]);

    const pendingLPOs = (lpos.data || []).filter(l => l.status === 'pending');
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
