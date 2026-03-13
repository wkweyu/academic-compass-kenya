import client from '@/api/client';

export interface IGAActivity {
  id: number;
  school: number;
  name: string;
  description: string;
  manager: number | null;
  manager_name?: string;
  start_date: string;
  status: 'active' | 'planned' | 'on_hold' | 'closed';
  income_account_id: number | null;
  expense_account_id: number | null;
  inventory_account_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface IGAProduct {
  id: number;
  school: number;
  name: string;
  description: string;
  unit_of_measure: string;
  sale_price: string;
  inventory_account_id: number | null;
  income_account_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IGAInventoryRecord {
  product_id: number;
  product_name: string;
  unit: string;
  quantity_available: string;
  stock_value: string;
  sold_quantity: string;
  spoiled_quantity: string;
  internal_use_quantity: string;
  last_updated: string;
}

export interface IGAProfitabilityRecord {
  activity_id: number;
  activity_name: string;
  total_sales: string;
  total_expenses: string;
  net_profit_loss: string;
}

export interface IGAProductionSummaryRecord {
  production_date: string;
  activity__name: string;
  product__name: string;
  unit: string;
  total_quantity: string;
}

export interface IGAIncomeExpenditureReport {
  total_income: string;
  total_expenses: string;
  net_income: string;
}

export interface IGABudgetActualRecord {
  budget_id: number;
  activity_id: number;
  activity_name: string;
  category: string;
  period_start: string;
  period_end: string;
  budget_amount: string;
  actual_amount: string;
  variance: string;
}

export interface IGAMovementSummary {
  id: number;
  movement_type: string;
  quantity: string;
  unit: string;
  reference: string;
  date: string;
  product__name: string;
  activity__name: string | null;
  recorded_by__first_name: string | null;
  recorded_by__last_name: string | null;
}

export interface IGAOverviewReport {
  summary: {
    activity_count: number;
    active_activity_count: number;
    product_count: number;
    pending_expense_count: number;
    stock_value: string;
    total_income: string;
    total_expenses: string;
    net_income: string;
  };
  profitability: IGAProfitabilityRecord[];
  production: IGAProductionSummaryRecord[];
  inventory: IGAInventoryRecord[];
  income_vs_expenditure: IGAIncomeExpenditureReport;
  budget_vs_actual: IGABudgetActualRecord[];
  recent_movements: IGAMovementSummary[];
}

export interface IGAExpense {
  id: number;
  activity: number;
  activity_name?: string;
  expense_category: string;
  description: string;
  amount: string;
  expense_date: string;
  status: 'pending' | 'approved' | 'rejected';
  recorded_by_name?: string;
  approved_by_name?: string;
  procurement_reference: string;
  created_at: string;
  updated_at: string;
}

export interface IGASale {
  id: number;
  activity: number;
  product: number;
  activity_name?: string;
  product_name?: string;
  quantity: string;
  unit_price: string;
  total_amount: string;
  customer_name: string;
  sale_date: string;
  payment_method: string;
  reference: string;
  created_at: string;
  updated_at: string;
}

export interface IGABudget {
  id: number;
  activity: number;
  activity_name?: string;
  category: string;
  budget_amount: string;
  period_start: string;
  period_end: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface IGAProductionRecord {
  id: number;
  activity: number;
  product: number;
  activity_name?: string;
  product_name?: string;
  quantity: string;
  unit: string;
  production_date: string;
  recorded_by_name?: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateActivityPayload {
  name: string;
  description?: string;
  start_date?: string;
  status?: IGAActivity['status'];
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  unit_of_measure: string;
  sale_price: string;
}

export interface ProductionPayload {
  activity: number;
  product: number;
  quantity: string;
  unit?: string;
  production_date?: string;
  notes?: string;
}

export interface SalePayload {
  activity: number;
  product: number;
  quantity: string;
  unit_price?: string;
  customer_name?: string;
  sale_date?: string;
  payment_method?: string;
  reference?: string;
}

export interface ExpensePayload {
  activity: number;
  expense_category: string;
  description: string;
  amount: string;
  expense_date?: string;
  procurement_reference?: string;
}

export interface ExpenseDecisionPayload {
  reason?: string;
}

export interface BudgetPayload {
  activity: number;
  category: string;
  budget_amount: string;
  period_start: string;
  period_end: string;
  notes?: string;
}

export interface InventoryActionPayload {
  product: number;
  activity?: number | null;
  quantity: string;
  reference?: string;
  notes?: string;
}

export interface InventoryAdjustmentPayload {
  product: number;
  activity?: number | null;
  quantity_delta: string;
  reference?: string;
  notes?: string;
}

export const igaService = {
  getOverview() {
    return client<IGAOverviewReport>('iga/reports/');
  },
  getActivities() {
    return client<IGAActivity[]>('iga/activities/');
  },
  getProducts() {
    return client<IGAProduct[]>('iga/products/');
  },
  getProductionRecords() {
    return client<IGAProductionRecord[]>('iga/production/');
  },
  getSales() {
    return client<IGASale[]>('iga/sales/');
  },
  getExpenses() {
    return client<IGAExpense[]>('iga/expenses/');
  },
  getBudgets() {
    return client<IGABudget[]>('iga/budgets/');
  },
  getInventoryMovements() {
    return client<IGAMovementSummary[]>('iga/inventory-movements/');
  },
  createActivity(payload: CreateActivityPayload) {
    return client<IGAActivity>('iga/activities/', { method: 'POST', data: payload });
  },
  updateActivity(activityId: number, payload: CreateActivityPayload) {
    return client<IGAActivity>(`iga/activities/${activityId}/`, { method: 'PUT', data: payload });
  },
  createProduct(payload: CreateProductPayload) {
    return client<IGAProduct>('iga/products/', { method: 'POST', data: payload });
  },
  updateProduct(productId: number, payload: CreateProductPayload) {
    return client<IGAProduct>(`iga/products/${productId}/`, { method: 'PUT', data: payload });
  },
  recordProduction(payload: ProductionPayload) {
    return client<IGAProductionRecord>('iga/production/', { method: 'POST', data: payload });
  },
  recordSale(payload: SalePayload) {
    return client<IGASale>('iga/sales/', { method: 'POST', data: payload });
  },
  recordExpense(payload: ExpensePayload) {
    return client<IGAExpense>('iga/expenses/', { method: 'POST', data: payload });
  },
  approveExpense(expenseId: number) {
    return client<IGAExpense>(`iga/expenses/${expenseId}/approve/`, { method: 'POST' });
  },
  rejectExpense(expenseId: number, payload: ExpenseDecisionPayload) {
    return client<IGAExpense>(`iga/expenses/${expenseId}/reject/`, { method: 'POST', data: payload });
  },
  createBudget(payload: BudgetPayload) {
    return client<IGABudget>('iga/budgets/', { method: 'POST', data: payload });
  },
  updateBudget(budgetId: number, payload: BudgetPayload) {
    return client<IGABudget>(`iga/budgets/${budgetId}/`, { method: 'PUT', data: payload });
  },
  recordSpoilage(payload: InventoryActionPayload) {
    return client<{ detail: string; movement_id: number }>('iga/inventory/spoilage/', { method: 'POST', data: payload });
  },
  recordInternalUse(payload: InventoryActionPayload) {
    return client<{ detail: string; movement_id: number }>('iga/inventory/internal-use/', { method: 'POST', data: payload });
  },
  adjustInventory(payload: InventoryAdjustmentPayload) {
    return client<{ detail: string; movement_id: number; stock_id: number }>('iga/inventory/adjust/', { method: 'POST', data: payload });
  },
};
