// Fees Management Types for School Administration

export interface FeeStructure {
  id: number;
  academic_year: number;
  term: 1 | 2 | 3;
  class_id: number;
  class_name?: string;
  fee_item: string;
  amount: number;
  is_mandatory: boolean;
  school: number;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  academic_year: number;
  term: 1 | 2 | 3;
  total_amount: number;
  paid_amount: number;
  balance: number;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  issued_on: string;
  due_date: string;
  items: InvoiceItem[];
  payments?: Payment[];
  school: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  fee_item: string;
  amount: number;
  is_paid: boolean;
}

export interface Payment {
  id: number;
  student_id: number;
  student_name?: string;
  admission_number?: string;
  invoice_id?: number;
  amount: number;
  payment_method: 'cash' | 'bank_transfer' | 'mpesa' | 'cheque' | 'card';
  reference_no: string;
  mpesa_code?: string;
  received_on: string;
  posted_by: string;
  notes?: string;
  school: number;
  created_at: string;
}

export interface Adjustment {
  id: number;
  student_id: number;
  student_name?: string;
  invoice_id?: number;
  adjustment_type: 'waiver' | 'discount' | 'penalty' | 'refund';
  amount: number; // positive for additions, negative for reductions
  reason: string;
  approved_by: string;
  created_at: string;
}

export interface FeeBalance {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string;
  total_invoiced: number;
  total_paid: number;
  total_adjustments: number;
  current_balance: number;
  overdue_amount: number;
  last_payment_date?: string;
  status: 'clear' | 'owing' | 'overpaid' | 'overdue';
}

export interface FeesStats {
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  collection_rate: number;
  overdue_amount: number;
  students_owing: number;
  students_clear: number;
  revenue_by_term: { term: number; amount: number }[];
  collection_by_method: { method: string; amount: number }[];
  class_collection_rates: { class_name: string; rate: number }[];
}

export interface FeesFilters {
  search?: string;
  class_id?: number;
  term?: number;
  academic_year?: number;
  status?: string;
  payment_method?: string;
  date_from?: string;
  date_to?: string;
}

// Constants
export const FEE_ITEMS = [
  { value: 'tuition', label: 'Tuition Fees' },
  { value: 'lunch', label: 'Lunch Fees' },
  { value: 'transport', label: 'Transport Fees' },
  { value: 'activity', label: 'Activity Fees' },
  { value: 'uniform', label: 'Uniform' },
  { value: 'books', label: 'Books & Stationery' },
  { value: 'exam', label: 'Exam Fees' },
  { value: 'development', label: 'Development Fund' },
  { value: 'medical', label: 'Medical Fees' },
  { value: 'other', label: 'Other Fees' }
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', color: 'bg-green-100 text-green-800' },
  { value: 'mpesa', label: 'M-PESA', color: 'bg-green-100 text-green-800' },
  { value: 'bank_transfer', label: 'Bank Transfer', color: 'bg-blue-100 text-blue-800' },
  { value: 'cheque', label: 'Cheque', color: 'bg-purple-100 text-purple-800' },
  { value: 'card', label: 'Card Payment', color: 'bg-orange-100 text-orange-800' }
];

export const INVOICE_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid', color: 'bg-red-100 text-red-800' },
  { value: 'partial', label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'paid', label: 'Fully Paid', color: 'bg-green-100 text-green-800' },
  { value: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' }
];

export const ADJUSTMENT_TYPES = [
  { value: 'waiver', label: 'Fee Waiver', color: 'bg-blue-100 text-blue-800' },
  { value: 'discount', label: 'Discount', color: 'bg-green-100 text-green-800' },
  { value: 'penalty', label: 'Late Payment Penalty', color: 'bg-red-100 text-red-800' },
  { value: 'refund', label: 'Refund', color: 'bg-purple-100 text-purple-800' }
];