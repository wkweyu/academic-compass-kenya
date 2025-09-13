import { api } from "@/api/api";
import { 
  FeeStructure, 
  Invoice, 
  Payment, 
  Adjustment, 
  FeeBalance, 
  FeesStats, 
  FeesFilters 
} from '@/types/fees';

export const feesService = {
  // Fee Structures
  async getFeeStructures(filters?: FeesFilters): Promise<FeeStructure[]> {
    const response = await api.get('/fee-structures/', filters);
    const data = response.data;
    return data.results;
  },

  async createFeeStructure(data: Omit<FeeStructure, 'id' | 'created_at' | 'updated_at'>): Promise<FeeStructure> {
    const response = await api.post('/fee-structures/', data);
    const newStructure = response.data;
    return newStructure;
  },

  async updateFeeStructure(id: number, data: Partial<FeeStructure>): Promise<FeeStructure | null> {
    const response = await api.patch(`/fee-structures/${id}/`, data);
    const updatedStructure = response.data;
    return updatedStructure;
  },

  async deleteFeeStructure(id: number): Promise<boolean> {
    await api.delete(`/fee-structures/${id}/`);
    return true;
  },

  // Invoices
  async getInvoices(filters?: FeesFilters): Promise<Invoice[]> {
    const response = await api.get('/invoices/', filters);
    const data = response.data;
    return data.results;
  },

  async getInvoice(id: number): Promise<Invoice | null> {
    const response = await api.get(`/invoices/${id}/`);
    const data = response.data;
    return data;
  },

  async generateInvoices(classId: number, term: number, year: number): Promise<{ generated: number; errors: string[] }> {
    const response = await api.post('/invoices/generate/', { class_id: classId, term, year });
    const data = response.data;
    return data;
  },

  async createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'balance'>): Promise<Invoice> {
    const response = await api.post('/invoices/', data);
    const newInvoice = response.data;
    return newInvoice;
  },

  // Payments
  async getPayments(filters?: FeesFilters): Promise<Payment[]> {
    const response = await api.get('/payments/', filters);
    const data = response.data;
    return data.results;
  },

  async createPayment(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
    const response = await api.post('/payments/', data);
    const newPayment = response.data;
    return newPayment;
  },

  // Fee Balances
  async getFeeBalances(filters?: FeesFilters): Promise<FeeBalance[]> {
    const response = await api.get('/fee-balances/', filters);
    const data = response.data;
    return data.results;
  },

  // Statistics
  async getFeesStats(): Promise<FeesStats> {
    const response = await api.get('/fees/stats/');
    const data = response.data;
    return data;
  },

  // Adjustments
  async getAdjustments(filters?: FeesFilters): Promise<Adjustment[]> {
    const response = await api.get('/adjustments/', filters);
    const data = response.data;
    return data.results;
  },

  async createAdjustment(data: Omit<Adjustment, 'id' | 'created_at'>): Promise<Adjustment> {
    const response = await api.post('/adjustments/', data);
    const newAdjustment = response.data;
    return newAdjustment;
  },

  // Export/Reports
  async exportInvoices(filters?: FeesFilters): Promise<Blob> {
    const response = await api.get('/invoices/export/', filters);
    const data = await response.data;
    return new Blob([data as BlobPart], { type: 'text/csv' });
  },

  async exportPayments(filters?: FeesFilters): Promise<Blob> {
    const response = await api.get('/payments/export/', filters);
    const data = await response.data;
    return new Blob([data as BlobPart], { type: 'text/csv' });
  }
};