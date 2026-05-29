import client from '@/api/client';
import { authHeaders, resolveApiBaseUrl } from '@/api/api';

export interface PaymentEvent {
  id: string;
  idempotency_key: string;
  provider: 'mpesa' | 'kcb_buni';
  provider_display: string;
  transaction_code: string;
  amount: number;
  phone_number: string;
  reference: string;
  status: 'RECEIVED' | 'DUPLICATE' | 'INVALID_REFERENCE' | 'UNRESOLVED_STUDENT' | 'RECONCILED';
  status_display: string;
  error_message: string;
  student: number | null;
  student_name: string | null;
  school: number;
  school_name: string;
  payment_transaction: number | null;
  retry_count: number;
  processed_at: string | null;
  sms_status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  sms_status_display?: string;
  sms_sent_at?: string | null;
  ingress_received_at?: string | null;
  routed_at?: string | null;
  system_version: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentDashboard {
  total_events: number;
  reconciled_events: number;
  unresolved_events: number;
  duplicate_events: number;
  total_amount: number;
  today_amount: number;
  providers: Array<{
    provider: string;
    count: number;
    amount: number;
  }>;
}

export interface StatementEntry {
  id: number;
  entry_type: string;
  transaction_date: string;
  created_at: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string;
  source_model: string;
  source_id: number | null;
  vote_head: string | null;
}

export interface StudentStatement {
  student: {
    id: number;
    full_name: string;
    admission_number: string;
    class_name: string | null;
  };
  filters: {
    year: number | null;
    term: number | null;
  };
  totals: {
    debit: number;
    credit: number;
    balance: number;
  };
  entries: StatementEntry[];
}

export interface TermClosePreviewStudent {
  student_id: number;
  student_name: string;
  admission_number: string;
  arrears: number;
  prepayment: number;
  sources: Array<{
    vote_head_id: number;
    vote_head_name: string;
    source_closing_balance: number;
    target_type: 'ARREARS' | 'PREPAYMENT';
    target_amount: number;
    target_year: number;
    target_term: number;
  }>;
}

export interface TermClosePreview {
  source_period: { year: number; term: number };
  target_period: { year: number; term: number };
  totals: {
    arrears: number;
    prepayment: number;
    students_affected: number;
  };
  students: TermClosePreviewStudent[];
}

export interface TermCloseRolloverResult {
  detail: string;
  period_id: number;
  source_period: { year: number; term: number };
  target_period: { year: number; term: number };
  rows_processed: number;
}

export interface TermCloseConversionRow {
  period_id: number;
  student_id: number;
  student_name: string;
  admission_number: string;
  source_year: number;
  source_term: number;
  target_year: number;
  target_term: number;
  source_vote_head: string;
  source_closing_balance: number;
  target_type: 'ARREARS' | 'PREPAYMENT';
  target_amount: number;
  created_at: string;
}

export interface TermCloseConversionReport {
  count: number;
  results: TermCloseConversionRow[];
}

export interface DailyCollectionRow {
  date: string;
  count: number;
  amount: number;
}

export interface DailyCollectionsReport {
  count: number;
  results: DailyCollectionRow[];
}

export interface ProviderCollectionRow {
  provider: string;
  count: number;
  amount: number;
}

export interface ProviderCollectionsReport {
  count: number;
  results: ProviderCollectionRow[];
}

export interface VoteheadCollectionRow {
  vote_head: string;
  amount: number;
}

export interface VoteheadCollectionsReport {
  count: number;
  results: VoteheadCollectionRow[];
}

export interface OutstandingStudentRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  outstanding_amount: number;
  vote_heads: Array<{
    vote_head: string;
    year: number;
    term: number;
    amount: number;
  }>;
}

export interface OutstandingBalancesReport {
  count: number;
  total_outstanding: number;
  results: OutstandingStudentRow[];
}

export interface StudentAgingRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  buckets: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  total: number;
}

export interface StudentAgingReport {
  as_of_date: string;
  totals: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  count: number;
  results: StudentAgingRow[];
  by_class: Array<{
    class_id: number | null;
    class_name: string;
    buckets: {
      '0-30': number;
      '31-60': number;
      '61-90': number;
      '90+': number;
    };
    total: number;
  }>;
  by_votehead: Array<{
    vote_head_id: number;
    vote_head_name: string;
    buckets: {
      '0-30': number;
      '31-60': number;
      '61-90': number;
      '90+': number;
    };
    total: number;
  }>;
}

export interface CollectionEffectivenessRow {
  year: number;
  term: number;
  amount_invoiced: number;
  amount_paid: number;
  collection_rate: number;
  arrears_closing: number;
  prepayment_closing: number;
}

export interface CollectionEffectivenessReport {
  count: number;
  summary: {
    total_invoiced: number;
    total_paid: number;
    overall_collection_rate: number;
  };
  results: CollectionEffectivenessRow[];
}

export interface DebtAnalyticsRow {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  buckets: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
  total_outstanding: number;
  terms_with_arrears: number;
  risk_band: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DebtAnalyticsReport {
  as_of_date: string;
  count: number;
  summary: {
    total_outstanding: number;
    students_with_arrears: number;
    high_risk_students: number;
    chronic_arrears_students: number;
    top10_concentration_pct: number;
  };
  results: DebtAnalyticsRow[];
}

export interface FinanceActivityRow {
  id: number;
  action: string;
  description: string;
  actor_id: number | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FinanceActivityLogResponse {
  count: number;
  results: FinanceActivityRow[];
}

export interface ScheduledExportJob {
  id: number;
  report: 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log';
  filters: Record<string, unknown>;
  run_at: string;
  status: 'SCHEDULED' | 'READY' | 'COMPLETED' | 'CANCELLED';
  executed_at: string | null;
  notes: string;
  created_at: string;
  download_url: string | null;
}

export interface ScheduledExportJobListResponse {
  count: number;
  results: ScheduledExportJob[];
}

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function ensureArrayResponse<T>(response: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(response)) {
    return {
      count: response.length,
      next: null,
      previous: null,
      results: response,
    };
  }
  return response;
}

async function downloadServerCsv(path: string, query: URLSearchParams, fallbackFilename: string) {
  const baseUrl = resolveApiBaseUrl().replace(/\/+$/, '');
  const url = `${baseUrl}/api/${path}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...authHeaders(),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`CSV export failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename="?([^\"]+)"?/i);
  const filename = filenameMatch?.[1] || fallbackFilename;

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

export const paymentService = {
  async getEvents(params?: {
    status?: string;
    provider?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.provider) query.append('provider', params.provider);
    if (params?.search) query.append('search', params.search);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await client<PaymentEvent[] | PaginatedResponse<PaymentEvent>>(`/payments/events/${suffix}`);
    return ensureArrayResponse(response);
  },

  async getUnresolvedEvents() {
    const response = await client<PaymentEvent[] | PaginatedResponse<PaymentEvent>>('/payments/events/unresolved/');
    return ensureArrayResponse(response);
  },

  async reprocessEvent(id: string) {
    return client<{ detail: string; event: PaymentEvent }>(`/payments/events/${id}/reprocess/`, {
      method: 'POST',
    });
  },

  async getEventDetail(id: string) {
    return client<PaymentEvent>(`/payments/events/${id}/`);
  },

  async getDashboard() {
    return client<PaymentDashboard>('/payments/dashboard/');
  },

  async getStudentStatement(studentId: string, filters?: { year?: string; term?: string }) {
    const query = new URLSearchParams();
    if (filters?.year) query.append('year', filters.year);
    if (filters?.term) query.append('term', filters.term);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<StudentStatement>(`/students/${studentId}/statement/${suffix}`);
  },

  async getTermClosePreview(year: number, term: number) {
    return client<TermClosePreview>(`/finance/term-close/preview/?year=${year}&term=${term}`);
  },

  async runTermCloseRollover(year: number, term: number, force = false) {
    return client<TermCloseRolloverResult>('/finance/term-close/rollover/', {
      method: 'POST',
      data: { year, term, force },
    });
  },

  async getTermCloseConversionReport(filters?: {
    year?: number;
    term?: number;
    student_id?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.year) query.append('year', String(filters.year));
    if (filters?.term) query.append('term', String(filters.term));
    if (filters?.student_id) query.append('student_id', String(filters.student_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<TermCloseConversionReport>(`/finance/term-close/conversion-report/${suffix}`);
  },

  async getDailyCollectionsReport(filters?: { start_date?: string; end_date?: string }) {
    const query = new URLSearchParams();
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<DailyCollectionsReport>(`/payments/reports/daily/${suffix}`);
  },

  async getProviderCollectionsReport(filters?: { start_date?: string; end_date?: string }) {
    const query = new URLSearchParams();
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<ProviderCollectionsReport>(`/payments/reports/providers/${suffix}`);
  },

  async getVoteheadCollectionsReport(filters?: { start_date?: string; end_date?: string }) {
    const query = new URLSearchParams();
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<VoteheadCollectionsReport>(`/payments/reports/voteheads/${suffix}`);
  },

  async getOutstandingBalancesReport(filters?: {
    year?: number;
    term?: number;
    student_id?: number;
    class_id?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.year) query.append('year', String(filters.year));
    if (filters?.term) query.append('term', String(filters.term));
    if (filters?.student_id) query.append('student_id', String(filters.student_id));
    if (filters?.class_id) query.append('class_id', String(filters.class_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<OutstandingBalancesReport>(`/finance/reports/outstanding/${suffix}`);
  },

  async getStudentAgingReport(filters?: {
    as_of_date?: string;
    student_id?: number;
    class_id?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.as_of_date) query.append('as_of_date', filters.as_of_date);
    if (filters?.student_id) query.append('student_id', String(filters.student_id));
    if (filters?.class_id) query.append('class_id', String(filters.class_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<StudentAgingReport>(`/finance/reports/student-aging/${suffix}`);
  },

  async getCollectionEffectivenessReport(filters?: {
    start_year?: number;
    end_year?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.start_year) query.append('start_year', String(filters.start_year));
    if (filters?.end_year) query.append('end_year', String(filters.end_year));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<CollectionEffectivenessReport>(`/finance/reports/collection-effectiveness/${suffix}`);
  },

  async getDebtAnalyticsReport(filters?: {
    as_of_date?: string;
    year?: number;
    term?: number;
    class_id?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.as_of_date) query.append('as_of_date', filters.as_of_date);
    if (filters?.year) query.append('year', String(filters.year));
    if (filters?.term) query.append('term', String(filters.term));
    if (filters?.class_id) query.append('class_id', String(filters.class_id));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<DebtAnalyticsReport>(`/finance/reports/debt-analytics/${suffix}`);
  },

  async logFinanceActivity(payload: {
    action: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    return client<{ detail: string }>('/finance/activity-log/', {
      method: 'POST',
      data: payload,
    });
  },

  async getFinanceActivityLog(filters?: {
    action?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (filters?.action) query.append('action', filters.action);
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    if (filters?.limit) query.append('limit', String(filters.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<FinanceActivityLogResponse>(`/finance/activity-log/${suffix}`);
  },

  async getScheduledExportJobs(filters?: { status?: string; limit?: number }) {
    const query = new URLSearchParams();
    if (filters?.status) query.append('status', filters.status);
    if (filters?.limit) query.append('limit', String(filters.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return client<ScheduledExportJobListResponse>(`/finance/reports/export-jobs/${suffix}`);
  },

  async scheduleExportJob(payload: {
    report: 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log';
    run_at: string;
    filters?: Record<string, unknown>;
    notes?: string;
  }) {
    return client<{ detail: string; job: ScheduledExportJob }>('/finance/reports/export-jobs/', {
      method: 'POST',
      data: payload,
    });
  },

  async cancelScheduledExportJob(jobId: number) {
    return client<{ detail: string }>(`/finance/reports/export-jobs/${jobId}/cancel/`, {
      method: 'POST',
    });
  },

  async downloadScheduledExportCsv(jobId: number) {
    const query = new URLSearchParams();
    await downloadServerCsv(`finance/reports/export-jobs/${jobId}/download/`, query, `scheduled-export-${jobId}.csv`);
  },

  async downloadPaymentReportCsv(report: 'daily' | 'providers' | 'voteheads', filters?: { start_date?: string; end_date?: string }) {
    const query = new URLSearchParams();
    query.append('report', report);
    query.append('stream', 'true');
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    await downloadServerCsv('payments/reports/export/', query, `payment-${report}-report.csv`);
  },

  async downloadFinanceReportCsv(
    report: 'outstanding' | 'student_aging' | 'collection_effectiveness' | 'activity_log',
    filters?: {
      year?: number;
      term?: number;
      student_id?: number;
      class_id?: number;
      as_of_date?: string;
      start_year?: number;
      end_year?: number;
      action?: string;
      start_date?: string;
      end_date?: string;
    },
  ) {
    const query = new URLSearchParams();
    query.append('report', report);
    query.append('stream', 'true');
    if (filters?.year) query.append('year', String(filters.year));
    if (filters?.term) query.append('term', String(filters.term));
    if (filters?.student_id) query.append('student_id', String(filters.student_id));
    if (filters?.class_id) query.append('class_id', String(filters.class_id));
    if (filters?.as_of_date) query.append('as_of_date', filters.as_of_date);
    if (filters?.start_year) query.append('start_year', String(filters.start_year));
    if (filters?.end_year) query.append('end_year', String(filters.end_year));
    if (filters?.action) query.append('action', filters.action);
    if (filters?.start_date) query.append('start_date', filters.start_date);
    if (filters?.end_date) query.append('end_date', filters.end_date);
    await downloadServerCsv('finance/reports/export/', query, `finance-${report}-report.csv`);
  },
};
