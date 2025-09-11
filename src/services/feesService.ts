// Fees Management Service
import { 
  FeeStructure, 
  Invoice, 
  InvoiceItem, 
  Payment, 
  Adjustment, 
  FeeBalance, 
  FeesStats, 
  FeesFilters 
} from '@/types/fees';

// Mock Data
const mockFeeStructures: FeeStructure[] = [
  {
    id: 1,
    academic_year: 2024,
    term: 2,
    class_id: 5,
    class_name: 'Grade 5',
    fee_item: 'tuition',
    amount: 15000,
    is_mandatory: true,
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 2,
    academic_year: 2024,
    term: 2,
    class_id: 5,
    class_name: 'Grade 5',
    fee_item: 'lunch',
    amount: 3000,
    is_mandatory: false,
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z'
  },
  {
    id: 3,
    academic_year: 2024,
    term: 2,
    class_id: 4,
    class_name: 'Grade 4',
    fee_item: 'tuition',
    amount: 14000,
    is_mandatory: true,
    school: 1,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z'
  }
];

const mockInvoices: Invoice[] = [
  {
    id: 1,
    student_id: 1,
    student_name: 'John Kamau',
    admission_number: 'ADM001',
    class_name: 'Grade 5',
    academic_year: 2024,
    term: 2,
    total_amount: 18000,
    paid_amount: 15000,
    balance: 3000,
    status: 'partial',
    issued_on: '2024-05-01',
    due_date: '2024-05-31',
    items: [
      { id: 1, invoice_id: 1, fee_item: 'tuition', amount: 15000, is_paid: true },
      { id: 2, invoice_id: 1, fee_item: 'lunch', amount: 3000, is_paid: false }
    ],
    school: 1,
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-15T00:00:00Z'
  },
  {
    id: 2,
    student_id: 2,
    student_name: 'Mary Wanjiku',
    admission_number: 'ADM002',
    class_name: 'Grade 5',
    academic_year: 2024,
    term: 2,
    total_amount: 18000,
    paid_amount: 18000,
    balance: 0,
    status: 'paid',
    issued_on: '2024-05-01',
    due_date: '2024-05-31',
    items: [
      { id: 3, invoice_id: 2, fee_item: 'tuition', amount: 15000, is_paid: true },
      { id: 4, invoice_id: 2, fee_item: 'lunch', amount: 3000, is_paid: true }
    ],
    school: 1,
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-10T00:00:00Z'
  },
  {
    id: 3,
    student_id: 3,
    student_name: 'Peter Ochieng',
    admission_number: 'ADM003',
    class_name: 'Grade 5',
    academic_year: 2024,
    term: 2,
    total_amount: 18000,
    paid_amount: 0,
    balance: 18000,
    status: 'overdue',
    issued_on: '2024-05-01',
    due_date: '2024-05-31',
    items: [
      { id: 5, invoice_id: 3, fee_item: 'tuition', amount: 15000, is_paid: false },
      { id: 6, invoice_id: 3, fee_item: 'lunch', amount: 3000, is_paid: false }
    ],
    school: 1,
    created_at: '2024-05-01T00:00:00Z',
    updated_at: '2024-05-01T00:00:00Z'
  }
];

const mockPayments: Payment[] = [
  {
    id: 1,
    student_id: 1,
    student_name: 'John Kamau',
    admission_number: 'ADM001',
    invoice_id: 1,
    amount: 15000,
    payment_method: 'mpesa',
    reference_no: 'PAY001',
    mpesa_code: 'QA12BC34DE',
    received_on: '2024-05-15',
    posted_by: 'Finance Officer',
    notes: 'Tuition payment for Term 2',
    school: 1,
    created_at: '2024-05-15T10:30:00Z'
  },
  {
    id: 2,
    student_id: 2,
    student_name: 'Mary Wanjiku',
    admission_number: 'ADM002',
    invoice_id: 2,
    amount: 18000,
    payment_method: 'bank_transfer',
    reference_no: 'PAY002',
    received_on: '2024-05-10',
    posted_by: 'Finance Officer',
    notes: 'Full payment for Term 2',
    school: 1,
    created_at: '2024-05-10T14:20:00Z'
  }
];

const mockAdjustments: Adjustment[] = [
  {
    id: 1,
    student_id: 4,
    student_name: 'Grace Njeri',
    invoice_id: 4,
    adjustment_type: 'waiver',
    amount: -5000,
    reason: 'Partial fee waiver for financial hardship',
    approved_by: 'Principal',
    created_at: '2024-05-20T00:00:00Z'
  }
];

// Simulate API delay
const apiDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));

export const feesService = {
  // Fee Structures
  async getFeeStructures(filters?: FeesFilters): Promise<FeeStructure[]> {
    await apiDelay();
    let structures = [...mockFeeStructures];
    
    if (filters?.class_id) {
      structures = structures.filter(s => s.class_id === filters.class_id);
    }
    
    if (filters?.term) {
      structures = structures.filter(s => s.term === filters.term);
    }
    
    if (filters?.academic_year) {
      structures = structures.filter(s => s.academic_year === filters.academic_year);
    }
    
    return structures;
  },

  async createFeeStructure(data: Omit<FeeStructure, 'id' | 'created_at' | 'updated_at'>): Promise<FeeStructure> {
    await apiDelay();
    
    const newStructure: FeeStructure = {
      ...data,
      id: Math.max(...mockFeeStructures.map(s => s.id)) + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockFeeStructures.push(newStructure);
    return newStructure;
  },

  async updateFeeStructure(id: number, data: Partial<FeeStructure>): Promise<FeeStructure | null> {
    await apiDelay();
    const index = mockFeeStructures.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    mockFeeStructures[index] = {
      ...mockFeeStructures[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    return mockFeeStructures[index];
  },

  async deleteFeeStructure(id: number): Promise<boolean> {
    await apiDelay();
    const index = mockFeeStructures.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    mockFeeStructures.splice(index, 1);
    return true;
  },

  // Invoices
  async getInvoices(filters?: FeesFilters): Promise<Invoice[]> {
    await apiDelay();
    let invoices = [...mockInvoices];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      invoices = invoices.filter(inv => 
        inv.student_name?.toLowerCase().includes(search) ||
        inv.admission_number?.toLowerCase().includes(search)
      );
    }
    
    if (filters?.status) {
      invoices = invoices.filter(inv => inv.status === filters.status);
    }
    
    if (filters?.class_id) {
      // In real app, filter by class
      invoices = invoices.filter(inv => inv.class_name?.includes('Grade'));
    }
    
    if (filters?.term) {
      invoices = invoices.filter(inv => inv.term === filters.term);
    }
    
    return invoices;
  },

  async getInvoice(id: number): Promise<Invoice | null> {
    await apiDelay();
    const invoice = mockInvoices.find(inv => inv.id === id);
    if (!invoice) return null;
    
    // Add payments to invoice
    const payments = mockPayments.filter(p => p.invoice_id === id);
    return { ...invoice, payments };
  },

  async generateInvoices(classId: number, term: number, year: number): Promise<{ generated: number; errors: string[] }> {
    await apiDelay();
    
    // Mock invoice generation logic
    const result = {
      generated: 25, // Mock number of invoices generated
      errors: [] as string[]
    };
    
    return result;
  },

  async createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'balance'>): Promise<Invoice> {
    await apiDelay();
    
    const balance = data.total_amount - data.paid_amount;
    const status: Invoice['status'] = 
      balance === 0 ? 'paid' : 
      data.paid_amount === 0 ? 'unpaid' : 'partial';
    
    const newInvoice: Invoice = {
      ...data,
      id: Math.max(...mockInvoices.map(i => i.id)) + 1,
      balance,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockInvoices.push(newInvoice);
    return newInvoice;
  },

  // Payments
  async getPayments(filters?: FeesFilters): Promise<Payment[]> {
    await apiDelay();
    let payments = [...mockPayments];
    
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      payments = payments.filter(p => 
        p.student_name?.toLowerCase().includes(search) ||
        p.admission_number?.toLowerCase().includes(search) ||
        p.reference_no.toLowerCase().includes(search)
      );
    }
    
    if (filters?.payment_method) {
      payments = payments.filter(p => p.payment_method === filters.payment_method);
    }
    
    if (filters?.date_from) {
      payments = payments.filter(p => p.received_on >= filters.date_from!);
    }
    
    if (filters?.date_to) {
      payments = payments.filter(p => p.received_on <= filters.date_to!);
    }
    
    return payments;
  },

  async createPayment(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    await apiDelay();
    
    const newPayment: Payment = {
      ...data,
      id: Math.max(...mockPayments.map(p => p.id)) + 1,
      created_at: new Date().toISOString()
    };
    
    mockPayments.push(newPayment);
    
    // Update invoice if linked
    if (data.invoice_id) {
      const invoiceIndex = mockInvoices.findIndex(inv => inv.id === data.invoice_id);
      if (invoiceIndex !== -1) {
        mockInvoices[invoiceIndex].paid_amount += data.amount;
        mockInvoices[invoiceIndex].balance = mockInvoices[invoiceIndex].total_amount - mockInvoices[invoiceIndex].paid_amount;
        
        // Update status
        const invoice = mockInvoices[invoiceIndex];
        invoice.status = 
          invoice.balance === 0 ? 'paid' : 
          invoice.paid_amount === 0 ? 'unpaid' : 'partial';
      }
    }
    
    return newPayment;
  },

  // Fee Balances
  async getFeeBalances(filters?: FeesFilters): Promise<FeeBalance[]> {
    await apiDelay();
    
    // Mock balances calculation
    const balances: FeeBalance[] = [
      {
        student_id: 1,
        student_name: 'John Kamau',
        admission_number: 'ADM001',
        class_name: 'Grade 5',
        total_invoiced: 18000,
        total_paid: 15000,
        total_adjustments: 0,
        current_balance: 3000,
        overdue_amount: 0,
        last_payment_date: '2024-05-15',
        status: 'owing'
      },
      {
        student_id: 2,
        student_name: 'Mary Wanjiku',
        admission_number: 'ADM002',
        class_name: 'Grade 5',
        total_invoiced: 18000,
        total_paid: 18000,
        total_adjustments: 0,
        current_balance: 0,
        overdue_amount: 0,
        last_payment_date: '2024-05-10',
        status: 'clear'
      },
      {
        student_id: 3,
        student_name: 'Peter Ochieng',
        admission_number: 'ADM003',
        class_name: 'Grade 5',
        total_invoiced: 18000,
        total_paid: 0,
        total_adjustments: 0,
        current_balance: 18000,
        overdue_amount: 18000,
        status: 'overdue'
      }
    ];
    
    return balances;
  },

  // Statistics
  async getFeesStats(): Promise<FeesStats> {
    await apiDelay();
    
    return {
      total_invoiced: 540000,
      total_collected: 425000,
      total_outstanding: 115000,
      collection_rate: 78.7,
      overdue_amount: 45000,
      students_owing: 15,
      students_clear: 35,
      revenue_by_term: [
        { term: 1, amount: 180000 },
        { term: 2, amount: 245000 },
        { term: 3, amount: 115000 }
      ],
      collection_by_method: [
        { method: 'M-PESA', amount: 280000 },
        { method: 'Bank Transfer', amount: 95000 },
        { method: 'Cash', amount: 50000 }
      ],
      class_collection_rates: [
        { class_name: 'Grade 1', rate: 85.2 },
        { class_name: 'Grade 2', rate: 82.1 },
        { class_name: 'Grade 3', rate: 79.5 },
        { class_name: 'Grade 4', rate: 76.8 },
        { class_name: 'Grade 5', rate: 74.3 }
      ]
    };
  },

  // Adjustments
  async getAdjustments(filters?: FeesFilters): Promise<Adjustment[]> {
    await apiDelay();
    return mockAdjustments;
  },

  async createAdjustment(data: Omit<Adjustment, 'id' | 'created_at'>): Promise<Adjustment> {
    await apiDelay();
    
    const newAdjustment: Adjustment = {
      ...data,
      id: Math.max(...mockAdjustments.map(a => a.id)) + 1,
      created_at: new Date().toISOString()
    };
    
    mockAdjustments.push(newAdjustment);
    return newAdjustment;
  },

  // Export/Reports
  async exportInvoices(filters?: FeesFilters): Promise<Blob> {
    await apiDelay();
    
    const invoices = await this.getInvoices(filters);
    
    const headers = [
      'Student Name', 'Admission No.', 'Class', 'Invoice Date', 
      'Due Date', 'Total Amount', 'Paid Amount', 'Balance', 'Status'
    ];
    
    const rows = invoices.map(inv => [
      inv.student_name,
      inv.admission_number,
      inv.class_name,
      inv.issued_on,
      inv.due_date,
      inv.total_amount,
      inv.paid_amount,
      inv.balance,
      inv.status
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    return new Blob([csvContent], { type: 'text/csv' });
  },

  async exportPayments(filters?: FeesFilters): Promise<Blob> {
    await apiDelay();
    
    const payments = await this.getPayments(filters);
    
    const headers = [
      'Student Name', 'Admission No.', 'Amount', 'Payment Method', 
      'Reference No.', 'Date Received', 'Posted By'
    ];
    
    const rows = payments.map(payment => [
      payment.student_name,
      payment.admission_number,
      payment.amount,
      payment.payment_method,
      payment.reference_no,
      payment.received_on,
      payment.posted_by
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    return new Blob([csvContent], { type: 'text/csv' });
  }
};